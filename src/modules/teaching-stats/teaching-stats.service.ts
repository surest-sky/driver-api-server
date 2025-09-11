import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { 
  TeachingStats, 
  SchoolStats, 
  StudentPerformanceStats,
  StatPeriod 
} from './teaching-stats.entity';
import { LearningRecordsService } from '../learning-records/learning-records.service';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class TeachingStatsService {
  constructor(
    @InjectRepository(TeachingStats) 
    private readonly teachingStatsRepo: Repository<TeachingStats>,
    @InjectRepository(SchoolStats) 
    private readonly schoolStatsRepo: Repository<SchoolStats>,
    @InjectRepository(StudentPerformanceStats) 
    private readonly studentStatsRepo: Repository<StudentPerformanceStats>,
    private readonly learningRecordsService: LearningRecordsService,
    private readonly videosService: VideosService,
  ) {}

  async generateDailyStats(date?: Date): Promise<void> {
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);

    // 生成教练统计
    await this.generateCoachStats(targetDate, StatPeriod.daily);
    
    // 生成学校统计
    await this.generateSchoolStats(targetDate, StatPeriod.daily);
    
    // 生成学生表现统计
    await this.generateStudentStats(targetDate, StatPeriod.daily);
  }

  private async generateCoachStats(date: Date, period: StatPeriod): Promise<void> {
    // 这里应该从数据库中查询所有教练
    // 为简化，假设我们有一个方法获取所有教练
    const coaches = await this.getActiveCoaches();

    for (const coach of coaches) {
      const stats = await this.calculateCoachStats(coach.id, coach.schoolId, date, period);
      
      await this.teachingStatsRepo.upsert({
        coachId: coach.id,
        schoolId: coach.schoolId,
        period,
        statDate: date,
        ...stats
      }, ['coachId', 'period', 'statDate']);
    }
  }

  private async calculateCoachStats(
    coachId: number, 
    schoolId: number, 
    date: Date, 
    period: StatPeriod
  ): Promise<Partial<TeachingStats>> {
    const { startDate, endDate } = this.getDateRange(date, period);

    // 获取教练的学生统计
    const studentStats = await this.learningRecordsService.getSchoolLearningStats(
      schoolId,
      startDate,
      endDate
    );

    // 获取视频统计
    const videoStats = await this.videosService.getVideoStats(schoolId, coachId);

    // 这里可以添加更多统计逻辑
    return {
      totalStudents: studentStats.totalStudents,
      activeStudents: studentStats.activeStudents,
      newStudents: 0, // 需要计算新增学生
      videosCreated: 0, // 需要计算在该时间段创建的视频
      totalVideoViews: videoStats.totalViews,
      totalVideoLikes: videoStats.totalLikes,
      totalWatchTimeSeconds: studentStats.totalWatchTime,
      completedVideos: studentStats.completedVideos,
      averageCompletionRate: studentStats.averageCompletionRate,
      appointmentsScheduled: 0, // 需要从appointment模块获取
      appointmentsCompleted: 0,
      messagesSent: 0, // 需要从message模块获取
      messagesReceived: 0,
    };
  }

  private async generateSchoolStats(date: Date, period: StatPeriod): Promise<void> {
    const schools = await this.getActiveSchools();

    for (const school of schools) {
      const stats = await this.calculateSchoolStats(school.id, date, period);
      
      await this.schoolStatsRepo.upsert({
        schoolId: school.id,
        period,
        statDate: date,
        ...stats
      }, ['schoolId', 'period', 'statDate']);
    }
  }

  private async calculateSchoolStats(
    schoolId: number, 
    date: Date, 
    period: StatPeriod
  ): Promise<Partial<SchoolStats>> {
    const { startDate, endDate } = this.getDateRange(date, period);

    const learningStats = await this.learningRecordsService.getSchoolLearningStats(
      schoolId,
      startDate,
      endDate
    );

    const videoStats = await this.videosService.getVideoStats(schoolId);

    return {
      totalCoaches: 0, // 需要查询教练数量
      activeCoaches: 0,
      totalStudents: learningStats.totalStudents,
      activeStudents: learningStats.activeStudents,
      newStudents: 0,
      totalVideos: videoStats.totalVideos,
      videosCreated: 0,
      totalVideoViews: videoStats.totalViews,
      totalVideoLikes: videoStats.totalLikes,
      totalWatchTimeSeconds: learningStats.totalWatchTime,
      completedVideos: learningStats.completedVideos,
      averageCompletionRate: learningStats.averageCompletionRate,
      totalAppointments: 0,
      appointmentsScheduled: 0,
      appointmentsCompleted: 0,
      totalMessages: 0,
      revenue: 0,
    };
  }

  private async generateStudentStats(date: Date, period: StatPeriod): Promise<void> {
    const students = await this.getActiveStudents();

    for (const student of students) {
      const stats = await this.calculateStudentStats(student.id, student.coachId, student.schoolId, date, period);
      
      await this.studentStatsRepo.upsert({
        studentId: student.id,
        coachId: student.coachId,
        schoolId: student.schoolId,
        period,
        statDate: date,
        ...stats
      }, ['studentId', 'period', 'statDate']);
    }
  }

  private async calculateStudentStats(
    studentId: number,
    coachId: number,
    schoolId: number,
    date: Date,
    period: StatPeriod
  ): Promise<Partial<StudentPerformanceStats>> {
    const { startDate, endDate } = this.getDateRange(date, period);

    const studentStats = await this.learningRecordsService.getStudentStats(studentId);
    const achievements = await this.learningRecordsService.getStudentAchievements(studentId);

    return {
      videosWatched: studentStats.totalVideos,
      videosCompleted: studentStats.completedVideos,
      totalWatchTimeSeconds: studentStats.totalWatchTime,
      averageCompletionRate: studentStats.averageCompletionRate,
      learningStreakDays: studentStats.streakDays,
      achievementsUnlocked: achievements.length,
      appointmentsAttended: 0,
      messagesSent: 0,
      engagementScore: this.calculateEngagementScore(studentStats),
    };
  }

  private calculateEngagementScore(stats: any): number {
    // 简单的参与度评分算法
    let score = 0;
    
    // 观看时间权重: 30%
    score += Math.min(stats.totalWatchTime / 3600, 10) * 3; // 最多30分，每小时3分
    
    // 完成率权重: 40%
    score += stats.averageCompletionRate * 0.4; // 最多40分
    
    // 连续学习天数权重: 20%
    score += Math.min(stats.streakDays, 10) * 2; // 最多20分，每天2分
    
    // 完成视频数权重: 10%
    score += Math.min(stats.completedVideos, 10); // 最多10分，每个视频1分

    return Math.round(score * 100) / 100; // 保留两位小数
  }

  async getCoachStats(
    coachId: number,
    period: StatPeriod,
    startDate?: Date,
    endDate?: Date,
    limit: number = 30
  ): Promise<TeachingStats[]> {
    const qb = this.teachingStatsRepo.createQueryBuilder('ts')
      .where('ts.coachId = :coachId', { coachId })
      .andWhere('ts.period = :period', { period });

    if (startDate && endDate) {
      qb.andWhere('ts.statDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    return qb
      .orderBy('ts.statDate', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getSchoolStats(
    schoolId: number,
    period: StatPeriod,
    startDate?: Date,
    endDate?: Date,
    limit: number = 30
  ): Promise<SchoolStats[]> {
    const qb = this.schoolStatsRepo.createQueryBuilder('ss')
      .where('ss.schoolId = :schoolId', { schoolId })
      .andWhere('ss.period = :period', { period });

    if (startDate && endDate) {
      qb.andWhere('ss.statDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    return qb
      .orderBy('ss.statDate', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getStudentPerformanceStats(
    studentId?: number,
    coachId?: number,
    schoolId?: number,
    period: StatPeriod = StatPeriod.daily,
    startDate?: Date,
    endDate?: Date,
    limit: number = 30
  ): Promise<StudentPerformanceStats[]> {
    const qb = this.studentStatsRepo.createQueryBuilder('sps')
      .leftJoinAndSelect('sps.student', 'student')
      .where('sps.period = :period', { period });

    if (studentId) {
      qb.andWhere('sps.studentId = :studentId', { studentId });
    }

    if (coachId) {
      qb.andWhere('sps.coachId = :coachId', { coachId });
    }

    if (schoolId) {
      qb.andWhere('sps.schoolId = :schoolId', { schoolId });
    }

    if (startDate && endDate) {
      qb.andWhere('sps.statDate BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    return qb
      .orderBy('sps.statDate', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getTopPerformingStudents(
    schoolId: number,
    period: StatPeriod = StatPeriod.monthly,
    limit: number = 10
  ): Promise<StudentPerformanceStats[]> {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    return this.studentStatsRepo.createQueryBuilder('sps')
      .leftJoinAndSelect('sps.student', 'student')
      .where('sps.schoolId = :schoolId', { schoolId })
      .andWhere('sps.period = :period', { period })
      .andWhere('sps.statDate >= :lastMonth', { lastMonth })
      .orderBy('sps.engagementScore', 'DESC')
      .limit(limit)
      .getMany();
  }

  private getDateRange(date: Date, period: StatPeriod): { startDate: Date, endDate: Date } {
    const startDate = new Date(date);
    const endDate = new Date(date);

    switch (period) {
      case StatPeriod.daily:
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case StatPeriod.weekly:
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case StatPeriod.monthly:
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case StatPeriod.yearly:
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    return { startDate, endDate };
  }

  private async getActiveCoaches(): Promise<any[]> {
    // 这里应该查询所有活跃的教练
    // 暂时返回空数组，实际应该从User表查询role为coach的用户
    return [];
  }

  private async getActiveSchools(): Promise<any[]> {
    // 这里应该查询所有活跃的学校
    // 暂时返回空数组，实际应该从School表查询
    return [];
  }

  private async getActiveStudents(): Promise<any[]> {
    // 这里应该查询所有活跃的学生
    // 暂时返回空数组，实际应该从User表查询role为student的用户
    return [];
  }
}