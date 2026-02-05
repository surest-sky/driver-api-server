import { Injectable, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { once } from 'events';

interface UploadSessionMeta {
  id: string;
  fileName: string;
  totalSize: number;
  chunkSize: number;
  uploadedChunks: number[];
  uploadedBytes: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UploadSessionService {
  private readonly baseDir = join(
    process.env.UPLOAD_TMP_DIR || process.env.TMPDIR || '/tmp',
    'uploads',
  );
  private readonly chunkDir = join(this.baseDir, 'chunks');
  private readonly videoDir = join(this.baseDir, 'videos');

  private async ensureDirs() {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(this.chunkDir, { recursive: true });
    await fs.mkdir(this.videoDir, { recursive: true });
  }

  async createOrRestoreSession(params: {
    sessionId?: string;
    fileName: string;
    totalSize: number;
    chunkSize: number;
  }): Promise<UploadSessionMeta> {
    await this.ensureDirs();
    const sessionId = params.sessionId?.trim() || randomUUID();
    const sessionDir = this.getSessionDir(sessionId);
    const metaPath = this.getMetaPath(sessionId);

    let meta: UploadSessionMeta;
    if (await this.exists(metaPath)) {
      meta = await this.loadMeta(sessionId);

      if (meta.totalSize !== params.totalSize) {
        throw new BadRequestException('总文件大小与会话记录不一致，请重新开始上传');
      }

      if (meta.chunkSize !== params.chunkSize) {
        throw new BadRequestException('分片大小与会话记录不一致，请重新开始上传');
      }

      await this.refreshUploadedChunks(meta);
      return meta;
    }

    await fs.mkdir(sessionDir, { recursive: true });
    meta = {
      id: sessionId,
      fileName: params.fileName,
      totalSize: params.totalSize,
      chunkSize: params.chunkSize,
      uploadedChunks: [],
      uploadedBytes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.saveMeta(meta);
    return meta;
  }

  async markChunkUploaded(sessionId: string, chunkIndex: number): Promise<UploadSessionMeta> {
    const meta = await this.loadMeta(sessionId);
    const sessionDir = this.getSessionDir(sessionId);
    const chunkPath = this.getChunkPath(sessionDir, chunkIndex);

    if (!(await this.exists(chunkPath))) {
      throw new BadRequestException(`未找到第${chunkIndex}分片文件`);
    }

    if (!meta.uploadedChunks.includes(chunkIndex)) {
      meta.uploadedChunks.push(chunkIndex);
      meta.uploadedChunks.sort((a, b) => a - b);
    }

    meta.uploadedBytes = await this.calculateUploadedBytes(sessionDir, meta.uploadedChunks);
    meta.updatedAt = new Date().toISOString();
    await this.saveMeta(meta);
    return meta;
  }

  async completeSession(sessionId: string): Promise<{ url: string; size: number }> {
    const meta = await this.loadMeta(sessionId);
    const sessionDir = this.getSessionDir(sessionId);
    const expectedChunks = Math.ceil(meta.totalSize / meta.chunkSize);

    if (meta.uploadedChunks.length !== expectedChunks) {
      throw new BadRequestException('分片未全部上传，无法合并文件');
    }

    const orderedChunks = Array.from(new Set(meta.uploadedChunks)).sort((a, b) => a - b);
    for (let i = 0; i < expectedChunks; i += 1) {
      if (orderedChunks[i] !== i) {
        throw new BadRequestException(`缺少第${i}个分片，请重新上传该分片`);
      }
    }

    const extension = extname(meta.fileName) || '.mp4';
    const finalFileName = `${Date.now().toString(36)}-${meta.id}${extension}`;
    const finalPath = join(this.videoDir, finalFileName);
    const writeStream = createWriteStream(finalPath);

    try {
      for (const index of orderedChunks) {
        const chunkPath = this.getChunkPath(sessionDir, index);
        await this.pipeChunk(chunkPath, writeStream);
      }
      writeStream.end();
      await once(writeStream, 'finish');
    } catch (error) {
      writeStream.destroy();
      throw error;
    }

    await this.cleanupSession(sessionId);

    return {
      url: `/static/videos/${finalFileName}`,
      size: meta.totalSize,
    };
  }

  private async pipeChunk(path: string, destination: NodeJS.WritableStream) {
    await new Promise<void>((resolve, reject) => {
      const readStream = createReadStream(path);
      readStream.on('error', reject);
      destination.on('error', reject);
      readStream.on('end', resolve);
      readStream.pipe(destination, { end: false });
    });
  }

  private async cleanupSession(sessionId: string) {
    const sessionDir = this.getSessionDir(sessionId);
    const metaPath = this.getMetaPath(sessionId);
    await fs.rm(sessionDir, { recursive: true, force: true });
    await fs.rm(metaPath, { force: true });
  }

  private getSessionDir(sessionId: string) {
    return join(this.chunkDir, sessionId);
  }

  private getMetaPath(sessionId: string) {
    return join(this.chunkDir, `${sessionId}.json`);
  }

  private getChunkPath(sessionDir: string, chunkIndex: number) {
    return join(sessionDir, `${chunkIndex}.part`);
  }

  private async loadMeta(sessionId: string): Promise<UploadSessionMeta> {
    const metaPath = this.getMetaPath(sessionId);
    if (!(await this.exists(metaPath))) {
      throw new BadRequestException('上传会话不存在或已过期');
    }
    const raw = await fs.readFile(metaPath, 'utf8');
    const meta = JSON.parse(raw) as UploadSessionMeta;
    await this.refreshUploadedChunks(meta);
    return meta;
  }

  private async refreshUploadedChunks(meta: UploadSessionMeta) {
    const sessionDir = this.getSessionDir(meta.id);
    if (!(await this.exists(sessionDir))) {
      meta.uploadedChunks = [];
      meta.uploadedBytes = 0;
      return;
    }

    const files = await fs.readdir(sessionDir);
    const chunkIndexes: number[] = [];
    for (const file of files) {
      if (!file.endsWith('.part')) continue;
      const idx = Number(file.replace('.part', ''));
      if (Number.isFinite(idx)) {
        chunkIndexes.push(idx);
      }
    }
    chunkIndexes.sort((a, b) => a - b);
    meta.uploadedChunks = Array.from(new Set(chunkIndexes));
    meta.uploadedBytes = await this.calculateUploadedBytes(sessionDir, meta.uploadedChunks);
    meta.updatedAt = new Date().toISOString();
    await this.saveMeta(meta);
  }

  private async calculateUploadedBytes(dir: string, indexes: number[]) {
    let total = 0;
    for (const idx of indexes) {
      const chunkPath = this.getChunkPath(dir, idx);
      try {
        const stat = await fs.stat(chunkPath);
        total += stat.size;
      } catch (_) {
        // 如果文件不存在则忽略（可能被手动删除）
      }
    }
    return total;
  }

  private async saveMeta(meta: UploadSessionMeta) {
    const metaPath = this.getMetaPath(meta.id);
    await fs.writeFile(metaPath, JSON.stringify(meta));
  }

  private async exists(path: string) {
    try {
      await fs.access(path);
      return true;
    } catch (_) {
      return false;
    }
  }
}
