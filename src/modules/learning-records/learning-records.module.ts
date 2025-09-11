import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningRecordsController } from './learning-records.controller';
import { LearningRecordsService } from './learning-records.service';
import { LearningRecord, LearningProgress, LearningAchievement } from './learning-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LearningRecord, LearningProgress, LearningAchievement])],
  controllers: [LearningRecordsController],
  providers: [LearningRecordsService],
  exports: [LearningRecordsService],
})
export class LearningRecordsModule {}