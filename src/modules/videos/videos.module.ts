import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideosController } from './videos.controller';
import { VideoCommentsController } from './video-comments.controller';
import { LearningRecordsController } from './learning-records.controller';
import { VideosService } from './videos.service';
import { VideoCommentsService } from './video-comments.service';
import { LearningRecordsService } from './learning-records.service';
import { Video, VideoComment, LearningRecord } from './video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Video, VideoComment, LearningRecord])],
  controllers: [VideosController, VideoCommentsController, LearningRecordsController],
  providers: [VideosService, VideoCommentsService, LearningRecordsService],
  exports: [VideosService, VideoCommentsService, LearningRecordsService],
})
export class VideosModule {}