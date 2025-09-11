import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { Video, VideoNote, VideoInteraction } from './video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Video, VideoNote, VideoInteraction])],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}