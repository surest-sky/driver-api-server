import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UploadSessionService } from './upload-session.service';
import { S3UploadService } from './s3-upload.service';
import { Request } from 'express';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CreateUploadSessionDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsNotEmpty()
  @IsString()
  fileName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalSize!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  chunkSize!: number;
}

class UploadChunkDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  index!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  size!: number;
}

class CompleteUploadDto {
  @IsOptional()
  @IsString()
  fileName?: string;
}

class AvatarPresignDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

class VideoPresignDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

class ImagePresignDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;
}

function filenameFactory(req: any, file: Express.Multer.File, cb: (e: any, filename: string) => void) {
  const name = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const ext = extname(file.originalname || '') || '.bin';
  cb(null, name + ext);
}

const uploadBaseDir = join(
  process.env.UPLOAD_TMP_DIR || process.env.TMPDIR || '/tmp',
  'uploads',
);

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly sessions: UploadSessionService,
    private readonly s3Uploads: S3UploadService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadBaseDir,
        filename: filenameFactory,
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    // 返回可直链访问的静态地址
    return { url: `/static/${file.filename}` };
  }

  @Post('video/sessions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async createSession(@Body() dto: CreateUploadSessionDto) {
    const meta = await this.sessions.createOrRestoreSession({
      sessionId: dto.sessionId,
      fileName: dto.fileName,
      totalSize: dto.totalSize,
      chunkSize: dto.chunkSize,
    });
    return {
      sessionId: meta.id,
      fileName: meta.fileName,
      totalSize: meta.totalSize,
      chunkSize: meta.chunkSize,
      uploadedChunks: meta.uploadedChunks,
      uploadedBytes: meta.uploadedBytes,
    };
  }

  @Post('video/sessions/:sessionId/chunk')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        index: { type: 'integer', minimum: 0 },
        size: { type: 'integer', minimum: 1 },
        file: { type: 'string', format: 'binary' },
      },
      required: ['index', 'size', 'file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const sessionId = req.params.sessionId;
          const dir = join(uploadBaseDir, 'chunks', sessionId);
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, _file, cb) => {
          const indexRaw = req.body?.index ?? req.query?.index;
          const index = Number(indexRaw);
          if (!Number.isFinite(index) || index < 0) {
            return cb(new Error('Invalid chunk index'), `invalid-${Date.now()}.part`);
          }
          cb(null, `${index}.part`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async uploadChunk(
    @Param('sessionId') sessionId: string,
    @Body() dto: UploadChunkDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (Number.isNaN(dto.index) || dto.index < 0) {
      throw new BadRequestException('index 参数无效');
    }
    if (Number.isNaN(dto.size) || dto.size <= 0) {
      throw new BadRequestException('size 参数无效');
    }
    if (!file) {
      throw new BadRequestException('缺少上传文件内容');
    }
    if (file.size !== dto.size) {
      // 允许有轻微偏差（某些平台可能对分片大小稍有调整）
      const diff = Math.abs(file.size - dto.size);
      if (diff > 1024) {
        throw new BadRequestException('分片大小与声明不一致，请重试');
      }
    }

    const meta = await this.sessions.markChunkUploaded(sessionId, dto.index);
    return {
      sessionId: meta.id,
      uploadedChunks: meta.uploadedChunks,
      uploadedBytes: meta.uploadedBytes,
      chunkIndex: dto.index,
    };
  }

  @Post('video/sessions/:sessionId/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async complete(@Param('sessionId') sessionId: string, @Body() _dto: CompleteUploadDto) {
    const result = await this.sessions.completeSession(sessionId);
    return result;
  }

  @Post('avatar/register')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadBaseDir,
        filename: filenameFactory,
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadRegisterAvatar(@UploadedFile() file: Express.Multer.File) {
    return { url: `/static/${file.filename}` };
  }

  @Post('avatar/presign')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async createAvatarPresign(@Req() req: Request, @Body() dto: AvatarPresignDto) {
    if (!this.s3Uploads.isEnabled) {
      throw new BadRequestException('S3 直传未配置');
    }
    const user = (req as any).user as { sub?: number | string } | undefined;
    if (!user || user.sub === undefined || user.sub === null) {
      throw new ForbiddenException('用户身份缺失');
    }
    const result = await this.s3Uploads.createAvatarUpload(String(user.sub), dto.fileName, dto.contentType);
    return {
      uploadUrl: result.uploadUrl,
      resourceUrl: result.resourceUrl,
      key: result.key,
      expiresIn: result.expiresIn,
      headers: result.headers,
    };
  }

  @Post('video/presign')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async createVideoPresign(@Req() req: Request, @Body() dto: VideoPresignDto) {
    if (!this.s3Uploads.isEnabled) {
      throw new BadRequestException('S3 直传未配置');
    }
    const user = (req as any).user as { sub?: number | string } | undefined;
    if (!user || user.sub === undefined || user.sub === null) {
      throw new ForbiddenException('用户身份缺失');
    }
    const result = await this.s3Uploads.createVideoUpload(String(user.sub), dto.fileName, dto.contentType);
    return {
      uploadUrl: result.uploadUrl,
      resourceUrl: result.resourceUrl,
      key: result.key,
      expiresIn: result.expiresIn,
      headers: result.headers,
    };
  }

  @Post('image/presign')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async createImagePresign(@Req() req: Request, @Body() dto: ImagePresignDto) {
    if (!this.s3Uploads.isEnabled) {
      throw new BadRequestException('S3 直传未配置');
    }
    const user = (req as any).user as { sub?: number | string } | undefined;
    if (!user || user.sub === undefined || user.sub === null) {
      throw new ForbiddenException('用户身份缺失');
    }
    const result = await this.s3Uploads.createImageUpload(String(user.sub), dto.fileName, dto.contentType);
    return {
      uploadUrl: result.uploadUrl,
      resourceUrl: result.resourceUrl,
      key: result.key,
      expiresIn: result.expiresIn,
      headers: result.headers,
    };
  }
}
