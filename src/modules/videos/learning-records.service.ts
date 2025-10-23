import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningRecord } from './video.entity';

@Injectable()
export class LearningRecordsService {
  constructor(
    @InjectRepository(LearningRecord)
    private readonly recordRepo: Repository<LearningRecord>,
  ) {}

  async updateProgress(
    userId: number,
    videoId: number,
    position: number,
    duration: number,
  ): Promise<LearningRecord> {
    const clampedPosition = Math.max(0, position);
    const clampedDuration = Math.max(duration, 1);
    const rawProgress = (clampedPosition / clampedDuration) * 100;
    const progress = Math.min(rawProgress, 100);
    const isCompleted = progress >= 95;

    let record = await this.recordRepo.findOne({
      where: { userId, videoId },
    });

    if (record) {
      const previousPosition = record.lastWatchPosition ?? 0;
      const delta = Math.max(0, clampedPosition - previousPosition);

      record.watchDuration = Math.max(0, record.watchDuration) + delta;
      record.watchDuration = Math.min(record.watchDuration, clampedDuration);
      record.lastWatchPosition = clampedPosition;
      record.progress = Number(progress.toFixed(2));
      record.isCompleted = isCompleted;
    } else {
      record = this.recordRepo.create({
        userId,
        videoId,
        watchDuration: Math.min(clampedPosition, clampedDuration),
        lastWatchPosition: clampedPosition,
        progress: Number(progress.toFixed(2)),
        isCompleted,
      });
    }

    return this.recordRepo.save(record);
  }

  async getMyLearningRecords(
    userId: number,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const qb = this.recordRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.video', 'video')
      .leftJoinAndSelect('video.uploader', 'uploader')
      .where('lr.userId = :userId', { userId })
      .orderBy('lr.lastWatchedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getRecordByUserAndVideo(
    userId: number,
    videoId: number,
  ): Promise<LearningRecord | null> {
    return this.recordRepo.findOne({
      where: { userId, videoId },
      relations: ['video'],
    });
  }

  async getRecentlyWatchedVideos(
    userId: number,
    limit: number = 10,
  ): Promise<LearningRecord[]> {
    return this.recordRepo.find({
      where: { userId },
      relations: ['video', 'video.uploader'],
      order: { lastWatchedAt: 'DESC' },
      take: limit,
    });
  }

  async getInProgressVideos(
    userId: number,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const qb = this.recordRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.video', 'video')
      .leftJoinAndSelect('video.uploader', 'uploader')
      .where('lr.userId = :userId', { userId })
      .andWhere('lr.isCompleted = :isCompleted', { isCompleted: false })
      .andWhere('lr.progress > 0')
      .orderBy('lr.lastWatchedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getCompletedVideos(
    userId: number,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const qb = this.recordRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.video', 'video')
      .leftJoinAndSelect('video.uploader', 'uploader')
      .where('lr.userId = :userId', { userId })
      .andWhere('lr.isCompleted = :isCompleted', { isCompleted: true })
      .orderBy('lr.lastWatchedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }
}
