import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeachingStatsController } from './teaching-stats.controller';
import { CoachStatsController } from './coach-stats.controller';
import { TeachingStatsService } from './teaching-stats.service';
import { TeachingStats, SchoolStats, StudentPerformanceStats } from './teaching-stats.entity';
import { LearningRecordsModule } from '../learning-records/learning-records.module';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeachingStats, SchoolStats, StudentPerformanceStats]),
    LearningRecordsModule,
    VideosModule,
  ],
  controllers: [TeachingStatsController, CoachStatsController],
  providers: [TeachingStatsService],
  exports: [TeachingStatsService],
})
export class TeachingStatsModule {}
