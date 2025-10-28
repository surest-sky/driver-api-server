import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { TeachingStatsService } from './teaching-stats.service';
import { StatPeriod, TeachingStats, StudentPerformanceStats } from './teaching-stats.entity';
import { VideosService } from '../videos/videos.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('coach')
@Controller('coach/stats')
export class CoachStatsController {
  constructor(
    private readonly teachingStatsService: TeachingStatsService,
    private readonly videosService: VideosService,
  ) {}

  @Get('overview')
  async getOverview(
    @Req() req: any,
    @Query('coachId') coachId?: string,
    @Query('period') period?: string,
  ) {
    const resolvedCoachId = this.resolveCoachId(req, coachId);
    const statPeriod = this.parsePeriod(period);

    const stats = await this.teachingStatsService.getCoachStats(
      resolvedCoachId,
      statPeriod,
      undefined,
      undefined,
      2,
    );

    const latest = stats[0] ?? null;
    const previous = stats.length > 1 ? stats[1] : null;

    return this.buildOverviewResponse(latest, previous);
  }

  @Get('activities')
  async getActivities(
    @Req() req: any,
    @Query('coachId') coachId?: string,
    @Query('limit') limit = '10',
    @Query('period') period?: string,
  ) {
    const resolvedCoachId = this.resolveCoachId(req, coachId);
    const statPeriod = this.parsePeriod(period);
    const limitNum = this.resolveLimit(limit, 10, 50);

    const stats = await this.teachingStatsService.getCoachStats(
      resolvedCoachId,
      statPeriod,
      undefined,
      undefined,
      limitNum,
    );

    const activities = this.buildActivities(stats, limitNum);
    return { activities };
  }

  @Get(['students', 'student-analysis'])
  async getStudentAnalysis(
    @Req() req: any,
    @Query('coachId') coachId?: string,
    @Query('limit') limit = '5',
    @Query('period') period?: string,
  ) {
    const resolvedCoachId = this.resolveCoachId(req, coachId);
    const schoolId = this.resolveSchoolId(req);
    const statPeriod = this.parsePeriod(period);
    const limitNum = this.resolveLimit(limit, 5, 50);

    const stats = await this.teachingStatsService.getStudentPerformanceStats(
      undefined,
      resolvedCoachId,
      schoolId ?? undefined,
      statPeriod,
      undefined,
      undefined,
      limitNum,
    );

    return this.buildStudentAnalysis(stats, limitNum);
  }

  @Get('videos')
  async getVideoStats(
    @Req() req: any,
    @Query('coachId') coachId?: string,
    @Query('limit') limit = '5',
    @Query('period') period?: string,
  ) {
    const resolvedCoachId = this.resolveCoachId(req, coachId);
    const schoolId = this.resolveSchoolId(req);
    const statPeriod = this.parsePeriod(period);
    const limitNum = this.resolveLimit(limit, 5, 20);

    const stats = await this.teachingStatsService.getCoachStats(
      resolvedCoachId,
      statPeriod,
      undefined,
      undefined,
      1,
    );

    const latest = stats[0] ?? null;

    const completionRaw = this.toOptionalNumber(latest?.averageCompletionRate);
    const avgCompletionRate = completionRaw == null
      ? null
      : (completionRaw > 1 ? completionRaw : completionRaw * 100);

    const overview = {
      totalViews: this.toNumber(latest?.totalVideoViews),
      avgCompletionRate,
      avgRating: null,
      totalComments: null,
      totalVideos: this.toNumber(latest?.videosCreated),
      totalWatchMinutes: this.roundNumber(
        this.toNumber(latest?.totalWatchTimeSeconds) / 60,
      ),
    };

    if (!schoolId) {
      return {
        overview,
        popularVideos: [],
      };
    }

    const recommendedVideos = await this.videosService.getRecommendedVideos(
      schoolId,
      resolvedCoachId,
      limitNum,
    );

    const popularVideos = recommendedVideos.map(video => ({
      id: Number(video.id),
      title: video.title,
      views: video.viewCount,
      completionRate: null,
      rating: null,
      thumbnailUrl: video.thumbnailUrl ?? null,
      durationSeconds: video.duration ?? null,
      uploadedAt: this.toIsoString(video.createdAt),
      uploadedBy: video.uploader?.name ?? null,
    }));

    return {
      overview,
      popularVideos,
    };
  }

  private resolveCoachId(req: any, coachId?: string): number {
    if (coachId != null && coachId !== '') {
      const parsed = Number(coachId);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new BadRequestException('coachId 无效');
      }
      return parsed;
    }
    const tokenCoachId = Number(req?.user?.sub);
    if (!Number.isFinite(tokenCoachId) || tokenCoachId <= 0) {
      throw new BadRequestException('无法确定教练身份');
    }
    return tokenCoachId;
  }

  private resolveSchoolId(req: any): number | null {
    const schoolId = req?.user?.schoolId;
    if (schoolId == null) {
      return null;
    }
    const parsed = Number(schoolId);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parsePeriod(period?: string): StatPeriod {
    if (!period) {
      return StatPeriod.daily;
    }
    const normalized = period.toLowerCase();
    if ((Object.values(StatPeriod) as string[]).includes(normalized)) {
      return normalized as StatPeriod;
    }
    return StatPeriod.daily;
  }

  private resolveLimit(
    limitRaw: string | number | undefined,
    fallback: number,
    max: number,
  ): number {
    const parsed = Number(limitRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  private buildOverviewResponse(latest: TeachingStats | null, previous: TeachingStats | null) {
    if (!latest) {
      return {
        totalStudents: 0,
        activeStudents: 0,
        totalVideos: 0,
        totalWatchHours: 0,
        studentsGrowth: null,
        activeRate: null,
        newVideos: 0,
        avgWatchTimeMinutes: null,
        updatedAt: null,
      };
    }

    const totalStudents = this.toNumber(latest.totalStudents);
    const activeStudents = this.toNumber(latest.activeStudents);
    const totalWatchHours = this.roundNumber(
      this.toNumber(latest.totalWatchTimeSeconds) / 3600,
    );
    const newVideos = this.toNumber(latest.videosCreated);
    const avgWatchMinutes = activeStudents > 0
      ? this.roundNumber(
          this.toNumber(latest.totalWatchTimeSeconds) / activeStudents / 60,
        )
      : null;

    let studentsGrowth: number | null = null;
    if (previous) {
      const prevTotal = this.toNumber(previous.totalStudents);
      const diff = totalStudents - prevTotal;
      if (prevTotal > 0) {
        studentsGrowth = this.roundNumber((diff / prevTotal) * 100, 2);
      } else if (diff > 0) {
        studentsGrowth = this.roundNumber(diff * 100, 2);
      }
    }

    const activeRate = totalStudents > 0
      ? this.roundNumber((activeStudents / totalStudents) * 100, 2)
      : null;

    return {
      totalStudents,
      activeStudents,
      totalVideos: newVideos,
      totalWatchHours,
      studentsGrowth,
      activeRate,
      newVideos,
      avgWatchTimeMinutes: avgWatchMinutes,
      updatedAt: this.toIsoString(latest.updatedAt ?? latest.statDate),
    };
  }

  private buildActivities(stats: TeachingStats[], limit: number) {
    const activities: Array<Record<string, unknown>> = [];

    for (const stat of stats) {
      const occurredAt = this.toIsoString(stat.statDate);
      const videosCreated = this.toNumber(stat.videosCreated);
      const completedVideos = this.toNumber(stat.completedVideos);
      const activeStudents = this.toNumber(stat.activeStudents);

      if (videosCreated > 0 && activities.length < limit) {
        activities.push({
          id: `${stat.id}-video`,
          type: 'video_upload',
          description: `新增上传 ${videosCreated} 个教学视频`,
          occurredAt,
        });
      }

      if (completedVideos > 0 && activities.length < limit) {
        activities.push({
          id: `${stat.id}-progress`,
          type: 'student_progress',
          description: `学员完成 ${completedVideos} 次课程回看`,
          occurredAt,
        });
      }

      if (activeStudents > 0 && activities.length < limit) {
        activities.push({
          id: `${stat.id}-active`,
          type: 'achievement',
          description: `活跃学员 ${activeStudents} 人`,
          occurredAt,
        });
      }

      if (activities.length >= limit) {
        break;
      }
    }

    return activities.slice(0, limit);
  }

  private buildStudentAnalysis(stats: StudentPerformanceStats[], limit: number) {
    const total = stats.length;
    let activeCount = 0;
    const levelBuckets = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
    } as Record<'beginner' | 'intermediate' | 'advanced', number>;

    const mapped = stats.map(item => {
      const completionRaw = this.toOptionalNumber(item.averageCompletionRate);
      const completionRate = completionRaw == null
        ? 0
        : (completionRaw > 1 ? completionRaw : completionRaw * 100);
      const watchHours = this.roundNumber(
        this.toNumber(item.totalWatchTimeSeconds) / 3600,
      );
      const level = this.resolveStudentLevel(completionRate);

      levelBuckets[level] += 1;
      if (completionRate > 0 || watchHours > 0) {
        activeCount += 1;
      }

      return {
        id: Number(item.studentId),
        name: item.student?.name ?? `学员${item.studentId}`,
        completionRate,
        watchHours,
        level,
        avatar: item.student?.avatarUrl ?? null,
      };
    });

    const topPerformers = mapped.slice(0, limit);

    const overview = {
      totalCount: total,
      activeCount,
      inactiveCount: Math.max(total - activeCount, 0),
      beginner: levelBuckets.beginner,
      intermediate: levelBuckets.intermediate,
      advanced: levelBuckets.advanced,
    };

    return {
      overview,
      distribution: overview,
      topPerformers,
    };
  }

  private resolveStudentLevel(completionRate: number): 'beginner' | 'intermediate' | 'advanced' {
    if (completionRate >= 80) {
      return 'advanced';
    }
    if (completionRate >= 50) {
      return 'intermediate';
    }
    return 'beginner';
  }

  private toNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    return num;
  }

  private toOptionalNumber(value: unknown): number | null {
    if (value == null) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private roundNumber(value: number, fractionDigits = 2): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const factor = Math.pow(10, fractionDigits);
    return Math.round(value * factor) / factor;
  }

  private toIsoString(value: unknown): string | null {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
      return value;
    }
    return null;
  }
}
