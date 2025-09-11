import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { 
  LearningRecord, 
  LearningProgress, 
  LearningAchievement,
  LearningActionType 
} from './learning-record.entity';

@Injectable()
export class LearningRecordsService {
  constructor(
    @InjectRepository(LearningRecord) 
    private readonly recordRepo: Repository<LearningRecord>,
    @InjectRepository(LearningProgress) 
    private readonly progressRepo: Repository<LearningProgress>,
    @InjectRepository(LearningAchievement) 
    private readonly achievementRepo: Repository<LearningAchievement>,
  ) {}

  async recordLearningAction(data: {
    studentId: number;
    coachId?: number;
    schoolId: number;
    videoId?: number;
    action: LearningActionType;
    durationSeconds?: number;
    progressSeconds?: number;
    completionRate?: number;
    metadata?: any;
    notes?: string;
  }): Promise<LearningRecord> {
    const record = this.recordRepo.create(data);
    const savedRecord = await this.recordRepo.save(record);

    // 如果是视频相关行为，更新学习进度
    if (data.videoId && data.action.startsWith('video_')) {
      await this.updateVideoProgress(data.studentId, data.videoId, data);
    }

    // 检查成就解锁
    await this.checkAchievements(data.studentId);

    return savedRecord;
  }

  private async updateVideoProgress(
    studentId: number, 
    videoId: number, 
    data: any
  ): Promise<void> {
    let progress = await this.progressRepo.findOne({
      where: { studentId, videoId }
    });

    if (!progress) {
      progress = this.progressRepo.create({
        studentId,
        videoId,
        firstWatchedAt: new Date(),
      });
    }

    progress.lastWatchedAt = new Date();

    switch (data.action) {
      case LearningActionType.video_start:
        progress.watchCount += 1;
        break;
      
      case LearningActionType.video_complete:
        progress.isCompleted = true;
        progress.completedAt = new Date();
        progress.completionRate = 100;
        if (data.durationSeconds) {
          progress.watchDurationSeconds += data.durationSeconds;
        }
        break;
      
      case LearningActionType.video_pause:
      case LearningActionType.video_seek:
        if (data.progressSeconds !== undefined) {
          progress.lastPositionSeconds = data.progressSeconds;
        }
        if (data.completionRate !== undefined) {
          progress.completionRate = data.completionRate;
        }
        if (data.durationSeconds) {
          progress.watchDurationSeconds += data.durationSeconds;
        }
        break;
    }

    await this.progressRepo.save(progress);
  }

  async getStudentLearningRecords(
    studentId: number,
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      action?: LearningActionType;
      videoId?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const qb = this.recordRepo.createQueryBuilder('lr')
      .leftJoinAndSelect('lr.video', 'video')
      .leftJoinAndSelect('lr.coach', 'coach')
      .where('lr.studentId = :studentId', { studentId });

    if (filters?.action) {
      qb.andWhere('lr.action = :action', { action: filters.action });
    }

    if (filters?.videoId) {
      qb.andWhere('lr.videoId = :videoId', { videoId: filters.videoId });
    }

    if (filters?.startDate && filters?.endDate) {
      qb.andWhere('lr.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    qb.orderBy('lr.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getStudentProgress(studentId: number): Promise<LearningProgress[]> {
    return this.progressRepo.find({
      where: { studentId },
      relations: ['video', 'video.coach'],
      order: { lastWatchedAt: 'DESC' }
    });
  }

  async getVideoProgress(studentId: number, videoId: number): Promise<LearningProgress | null> {
    return this.progressRepo.findOne({
      where: { studentId, videoId },
      relations: ['video']
    });
  }

  async getStudentStats(studentId: number): Promise<{
    totalWatchTime: number;
    completedVideos: number;
    totalVideos: number;
    averageCompletionRate: number;
    streakDays: number;
    lastActiveDate: Date | null;
  }> {
    const progress = await this.progressRepo.find({
      where: { studentId }
    });

    const totalWatchTime = progress.reduce((sum, p) => sum + p.watchDurationSeconds, 0);
    const completedVideos = progress.filter(p => p.isCompleted).length;
    const totalVideos = progress.length;
    const averageCompletionRate = totalVideos > 0 
      ? progress.reduce((sum, p) => sum + p.completionRate, 0) / totalVideos 
      : 0;

    // 计算连续学习天数
    const recentRecords = await this.recordRepo.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
      take: 30
    });

    const streakDays = this.calculateStreakDays(recentRecords);
    const lastActiveDate = recentRecords.length > 0 ? recentRecords[0].createdAt : null;

    return {
      totalWatchTime,
      completedVideos,
      totalVideos,
      averageCompletionRate,
      streakDays,
      lastActiveDate
    };
  }

  private calculateStreakDays(records: LearningRecord[]): number {
    if (records.length === 0) return 0;

    const dates = Array.from(new Set(
      records.map(r => r.createdAt.toDateString())
    )).sort().reverse();

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const dateStr of dates) {
      const recordDate = new Date(dateStr);
      const diffDays = Math.floor((currentDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === streak) {
        streak++;
      } else if (diffDays === streak + 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  async getSchoolLearningStats(
    schoolId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalStudents: number;
    activeStudents: number;
    totalWatchTime: number;
    completedVideos: number;
    averageCompletionRate: number;
    popularVideos: any[];
  }> {
    const dateFilter = startDate && endDate 
      ? { createdAt: Between(startDate, endDate) }
      : {};

    // 获取学校所有学习记录
    const records = await this.recordRepo.find({
      where: { schoolId, ...dateFilter },
      relations: ['video', 'student']
    });

    // 获取学校所有学习进度
    const progress = await this.progressRepo.find({
      where: { student: { schoolId } },
      relations: ['student', 'video']
    });

    const totalStudents = new Set(records.map(r => r.studentId)).size;
    const activeStudents = new Set(
      records.filter(r => {
        if (!startDate) return true;
        return r.createdAt >= startDate;
      }).map(r => r.studentId)
    ).size;

    const totalWatchTime = progress.reduce((sum, p) => sum + p.watchDurationSeconds, 0);
    const completedVideos = progress.filter(p => p.isCompleted).length;
    const averageCompletionRate = progress.length > 0
      ? progress.reduce((sum, p) => sum + p.completionRate, 0) / progress.length
      : 0;

    // 热门视频统计
    const videoStats = new Map();
    progress.forEach(p => {
      if (!videoStats.has(p.videoId)) {
        videoStats.set(p.videoId, {
          video: p.video,
          viewCount: 0,
          completionCount: 0,
          totalWatchTime: 0
        });
      }
      const stats = videoStats.get(p.videoId);
      stats.viewCount += p.watchCount;
      stats.totalWatchTime += p.watchDurationSeconds;
      if (p.isCompleted) stats.completionCount++;
    });

    const popularVideos = Array.from(videoStats.values())
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10);

    return {
      totalStudents,
      activeStudents,
      totalWatchTime,
      completedVideos,
      averageCompletionRate,
      popularVideos
    };
  }

  private async checkAchievements(studentId: number): Promise<void> {
    const stats = await this.getStudentStats(studentId);
    
    // 定义成就规则
    const achievementRules = [
      {
        type: 'first_video',
        title: '初次观看',
        description: '观看了第一个教学视频',
        condition: () => stats.totalVideos >= 1
      },
      {
        type: 'video_completion_5',
        title: '学习达人',
        description: '完成了5个教学视频',
        condition: () => stats.completedVideos >= 5
      },
      {
        type: 'video_completion_20',
        title: '学习专家',
        description: '完成了20个教学视频',
        condition: () => stats.completedVideos >= 20
      },
      {
        type: 'watch_time_hour',
        title: '时间管理',
        description: '累计学习时间超过1小时',
        condition: () => stats.totalWatchTime >= 3600
      },
      {
        type: 'watch_time_day',
        title: '学习坚持者',
        description: '累计学习时间超过8小时',
        condition: () => stats.totalWatchTime >= 28800
      },
      {
        type: 'streak_week',
        title: '七日坚持',
        description: '连续学习7天',
        condition: () => stats.streakDays >= 7
      }
    ];

    for (const rule of achievementRules) {
      if (rule.condition()) {
        const existing = await this.achievementRepo.findOne({
          where: { studentId, achievementType: rule.type }
        });

        if (!existing) {
          await this.achievementRepo.save({
            studentId,
            achievementType: rule.type,
            title: rule.title,
            description: rule.description,
            isUnlocked: true,
            unlockedAt: new Date()
          });
        }
      }
    }
  }

  async getStudentAchievements(studentId: number): Promise<LearningAchievement[]> {
    return this.achievementRepo.find({
      where: { studentId },
      order: { unlockedAt: 'DESC' }
    });
  }
}