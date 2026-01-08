import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'path';
import { randomBytes } from 'crypto';

export interface PresignedAvatarUpload {
  uploadUrl: string;
  resourceUrl: string;
  key: string;
  expiresIn: number;
  headers: Record<string, string>;
}

@Injectable()
export class S3UploadService {
  private readonly logger = new Logger(S3UploadService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | null;
  private readonly region: string | null;
  private readonly avatarPrefix: string;
  private readonly videoPrefix: string;
  private readonly publicBaseUrl: string | null;
  private readonly expiresInSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? null;
    this.region = this.config.get<string>('AWS_S3_REGION') ?? null;
    const accessKey = this.config.get<string>('AWS_ACCESS_KEY_ID') ?? null;
    const secretKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? null;
    const endpoint = this.config.get<string>('AWS_S3_ENDPOINT') ?? undefined;
    const forcePathStyle = this.config.get<string>('AWS_S3_FORCE_PATH_STYLE') === 'true';

    this.avatarPrefix = this.normalizePrefix(
      this.config.get<string>('AWS_S3_AVATAR_PREFIX') ?? 'avatars/',
      'avatars',
    );
    this.videoPrefix = this.normalizePrefix(
      this.config.get<string>('AWS_S3_VIDEO_PREFIX') ?? 'video/',
      'video',
    );
    this.publicBaseUrl = this.config.get<string>('AWS_S3_PUBLIC_BASE_URL') ?? null;
    const expiresEnv = Number(this.config.get<string>('AWS_S3_PRESIGN_EXPIRES_IN'));
    this.expiresInSeconds = Number.isFinite(expiresEnv) && expiresEnv > 0 ? Math.min(3600, expiresEnv) : 300;

    if (this.bucket && this.region && accessKey && secretKey) {
      this.client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        endpoint,
        forcePathStyle,
      });
    } else {
      this.client = null;
      if (!this.bucket || !this.region) {
        this.logger.warn('S3 配置缺失，已禁用直传功能');
      }
    }
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  async createAvatarUpload(userId: string, fileName: string, contentType: string): Promise<PresignedAvatarUpload> {
    if (!this.client || !this.bucket) {
      throw new InternalServerErrorException('S3 直传未配置');
    }
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '') || 'user';
    const now = Date.now();
    const ext = this.pickExtension(fileName, contentType);
    const key = `${this.avatarPrefix}/${sanitizedUserId}/${now}-${Math.random().toString(36).slice(2, 10)}${ext}`;

    return this.createPresignedUpload(key, contentType);
  }

  async createVideoUpload(userId: string, fileName: string, contentType: string): Promise<PresignedAvatarUpload> {
    if (!this.client || !this.bucket) {
      throw new InternalServerErrorException('S3 直传未配置');
    }
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '') || 'user';
    const baseName = this.normalizeFileName(fileName);
    const hash = randomBytes(6).toString('hex');
    const ext = this.pickExtension(fileName, contentType);
    const key = `${sanitizedUserId}/${this.videoPrefix}/${baseName}-${hash}${ext}`;

    return this.createPresignedUpload(key, contentType);
  }

  async createImageUpload(userId: string, fileName: string, contentType: string): Promise<PresignedAvatarUpload> {
    if (!this.client || !this.bucket) {
      throw new InternalServerErrorException('S3 直传未配置');
    }
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '') || 'user';
    const now = Date.now();
    const hash = Math.random().toString(36).slice(2, 10);
    const ext = this.pickExtension(fileName, contentType);
    const key = `${sanitizedUserId}/images/${now}-${hash}${ext}`;

    return this.createPresignedUpload(key, contentType);
  }

  private pickExtension(fileName: string, contentType: string): string {
    const ext = extname(fileName || '').toLowerCase();
    if (ext) {
      return ext;
    }
    const fallback = this.guessExtension(contentType);
    return fallback ? `.${fallback}` : '';
  }

  private guessExtension(contentType: string): string | null {
    switch (contentType) {
      case 'image/png':
        return 'png';
      case 'image/jpeg':
        return 'jpg';
      case 'image/gif':
        return 'gif';
      case 'image/webp':
        return 'webp';
      default:
        return null;
    }
  }

  private buildPublicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }
    if (!this.bucket || !this.region) {
      return key;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private resolveAcl(): ObjectCannedACL | undefined {
    const aclRaw = this.config.get<string>('AWS_S3_AVATAR_ACL');
    if (!aclRaw) {
      return undefined;
    }
    const normalized = aclRaw.trim() as ObjectCannedACL;
    const allowed: ObjectCannedACL[] = [
      'private',
      'public-read',
      'public-read-write',
      'authenticated-read',
      'aws-exec-read',
      'bucket-owner-read',
      'bucket-owner-full-control',
    ];
    return allowed.includes(normalized) ? normalized : undefined;
  }

  private normalizePrefix(raw: string, fallback: string): string {
    const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
    return trimmed.length > 0 ? trimmed : fallback;
  }

  private normalizeFileName(fileName: string): string {
    const withoutExt = fileName.replace(/\.[^/.]+$/, '').toLowerCase();
    const slug = withoutExt.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug.length > 0 ? slug : 'video';
  }

  private async createPresignedUpload(key: string, contentType: string): Promise<PresignedAvatarUpload> {
    if (!this.client || !this.bucket) {
      throw new InternalServerErrorException('S3 直传未配置');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ACL: this.resolveAcl(),
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: this.expiresInSeconds });
    const resourceUrl = this.buildPublicUrl(key);

    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };
    const acl = this.resolveAcl();
    if (acl) {
      headers['x-amz-acl'] = acl;
    }

    return {
      uploadUrl,
      resourceUrl,
      key,
      expiresIn: this.expiresInSeconds,
      headers,
    };
  }
}
