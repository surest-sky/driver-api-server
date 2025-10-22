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
    // 查找现有记录
    let record = await this.recordRepo.findOne({
      where: { userId, videoId },
    });

    // 计算进度百分比
    const progress = duration > 0 ? Math.min((position / duration) * 100, 100) : 0;
    const isCompleted = progress >= 95; // 观看95%以上视为完成

    if (record) {
      // 更新现有记录
      record.lastWatchPosition = position;
      record.progress = Number(progress.toFixed(2));
      record.isCompleted = isCompleted;

      // 累计观看时长（简化处理：如果position大于上次记录，增加差值）
      if (position > record.lastWatchPosition) {
        record.watchDuration += position - record.lastWatchPosition;
      }
    } else {
      // 创建新记录
      record = this.recordRepo.create({
        userId,
        videoId,
        lastWatchPosition: position,
        watchDuration: position,
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
