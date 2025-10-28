import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadSessionService } from './upload-session.service';
import { S3UploadService } from './s3-upload.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadSessionService, S3UploadService],
  exports: [UploadSessionService, S3UploadService],
})
export class UploadsModule {}
