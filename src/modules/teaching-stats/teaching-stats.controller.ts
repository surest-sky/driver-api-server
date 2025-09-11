import { 
  Controller, 
  Get, 
  Post,
  Query, 
  Req, 
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { TeachingStatsService } from './teaching-stats.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { StatPeriod } from './teaching-stats.entity';

@UseGuards(JwtAuthGuard)
@Controller('teaching-stats')
export class TeachingStatsController {
  constructor(private readonly teachingStatsService: TeachingStatsService) {}

  @Post('generate-daily')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async generateDailyStats(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    await this.teachingStatsService.generateDailyStats(targetDate);
    return { message: 'Daily stats generated successfully' };
  }

  @Get('coach-stats')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getCoachStats(
    @Req() req: any,
    @Query('period') period: StatPeriod = StatPeriod.daily,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit = '30'
  ) {
    const limitNum = Number(limit) || 30;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const stats = await this.teachingStatsService.getCoachStats(
      req.user.sub,
      period,
      start,
      end,
      limitNum
    );
    return stats;
  }

  @Get('school-stats')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getSchoolStats(
    @Req() req: any,
    @Query('period') period: StatPeriod = StatPeriod.daily,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit = '30'
  ) {
    const limitNum = Number(limit) || 30;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const stats = await this.teachingStatsService.getSchoolStats(
      req.user.schoolId,
      period,
      start,
      end,
      limitNum
    );
    return stats;
  }

  @Get('student-performance')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getStudentPerformanceStats(
    @Req() req: any,
    @Query('student_id') studentId?: string,
    @Query('coach_id') coachId?: string,
    @Query('period') period: StatPeriod = StatPeriod.daily,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit = '30'
  ) {
    const limitNum = Number(limit) || 30;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    const studentIdNum = studentId ? Number(studentId) : undefined;
    const coachIdNum = coachId ? Number(coachId) : req.user.sub;

    const stats = await this.teachingStatsService.getStudentPerformanceStats(
      studentIdNum,
      coachIdNum,
      req.user.schoolId,
      period,
      start,
      end,
      limitNum
    );
    return stats;
  }

  @Get('top-students')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getTopPerformingStudents(
    @Req() req: any,
    @Query('period') period: StatPeriod = StatPeriod.monthly,
    @Query('limit') limit = '10'
  ) {
    const limitNum = Number(limit) || 10;
    
    const topStudents = await this.teachingStatsService.getTopPerformingStudents(
      req.user.schoolId,
      period,
      limitNum
    );
    return topStudents;
  }

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getDashboardStats(@Req() req: any) {
    const today = new Date();
    const thisWeek = new Date();
    thisWeek.setDate(today.getDate() - 7);
    const thisMonth = new Date();
    thisMonth.setMonth(today.getMonth() - 1);

    // 获取今日统计
    const todayStats = await this.teachingStatsService.getCoachStats(
      req.user.sub,
      StatPeriod.daily,
      today,
      today,
      1
    );

    // 获取本周统计
    const weeklyStats = await this.teachingStatsService.getCoachStats(
      req.user.sub,
      StatPeriod.weekly,
      thisWeek,
      today,
      1
    );

    // 获取本月统计
    const monthlyStats = await this.teachingStatsService.getCoachStats(
      req.user.sub,
      StatPeriod.monthly,
      thisMonth,
      today,
      1
    );

    // 获取优秀学生
    const topStudents = await this.teachingStatsService.getTopPerformingStudents(
      req.user.schoolId,
      StatPeriod.monthly,
      5
    );

    // 获取最近7天的趋势数据
    const trendStats = await this.teachingStatsService.getCoachStats(
      req.user.sub,
      StatPeriod.daily,
      thisWeek,
      today,
      7
    );

    return {
      today: todayStats[0] || null,
      weekly: weeklyStats[0] || null,
      monthly: monthlyStats[0] || null,
      topStudents,
      trends: trendStats.reverse() // 按时间正序排列
    };
  }

  @Get('school-dashboard')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getSchoolDashboardStats(@Req() req: any) {
    const today = new Date();
    const thisWeek = new Date();
    thisWeek.setDate(today.getDate() - 7);
    const thisMonth = new Date();
    thisMonth.setMonth(today.getMonth() - 1);

    // 获取学校今日统计
    const todayStats = await this.teachingStatsService.getSchoolStats(
      req.user.schoolId,
      StatPeriod.daily,
      today,
      today,
      1
    );

    // 获取学校本周统计
    const weeklyStats = await this.teachingStatsService.getSchoolStats(
      req.user.schoolId,
      StatPeriod.weekly,
      thisWeek,
      today,
      1
    );

    // 获取学校本月统计
    const monthlyStats = await this.teachingStatsService.getSchoolStats(
      req.user.schoolId,
      StatPeriod.monthly,
      thisMonth,
      today,
      1
    );

    // 获取最近30天的趋势数据
    const trendStats = await this.teachingStatsService.getSchoolStats(
      req.user.schoolId,
      StatPeriod.daily,
      thisMonth,
      today,
      30
    );

    return {
      today: todayStats[0] || null,
      weekly: weeklyStats[0] || null,
      monthly: monthlyStats[0] || null,
      trends: trendStats.reverse() // 按时间正序排列
    };
  }
}