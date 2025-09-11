import { 
  Body, 
  Controller, 
  Get, 
  Post, 
  Query, 
  Req, 
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { LearningRecordsService } from './learning-records.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { LearningActionType } from './learning-record.entity';
import { IsNotEmpty, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';

class RecordLearningActionDto {
  @IsOptional()
  videoId?: number;

  @IsEnum(LearningActionType)
  action!: LearningActionType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  progressSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  completionRate?: number;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  notes?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('learning-records')
export class LearningRecordsController {
  constructor(private readonly learningRecordsService: LearningRecordsService) {}

  @Post()
  async recordAction(@Req() req: any, @Body() dto: RecordLearningActionDto) {
    const record = await this.learningRecordsService.recordLearningAction({
      studentId: req.user.sub,
      schoolId: req.user.schoolId,
      coachId: req.user.coachId,
      ...dto
    });
    return record;
  }

  @Get('my-records')
  async getMyRecords(
    @Req() req: any,
    @Query('action') action?: LearningActionType,
    @Query('video_id') videoId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page = '1',
    @Query('page_size') pageSize = '20'
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    const filters = {
      action,
      videoId: videoId ? Number(videoId) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    const result = await this.learningRecordsService.getStudentLearningRecords(
      req.user.sub,
      p,
      ps,
      filters
    );
    return result;
  }

  @Get('my-progress')
  async getMyProgress(@Req() req: any) {
    const progress = await this.learningRecordsService.getStudentProgress(req.user.sub);
    return progress;
  }

  @Get('video-progress')
  async getVideoProgress(
    @Req() req: any,
    @Query('video_id') videoId: string
  ) {
    const videoIdNum = Number(videoId);
    if (!videoIdNum || isNaN(videoIdNum)) {
      throw new Error('Invalid video_id parameter');
    }

    const progress = await this.learningRecordsService.getVideoProgress(
      req.user.sub,
      videoIdNum
    );
    return progress;
  }

  @Get('my-stats')
  async getMyStats(@Req() req: any) {
    const stats = await this.learningRecordsService.getStudentStats(req.user.sub);
    return stats;
  }

  @Get('my-achievements')
  async getMyAchievements(@Req() req: any) {
    const achievements = await this.learningRecordsService.getStudentAchievements(req.user.sub);
    return achievements;
  }

  @Get('school-stats')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getSchoolStats(
    @Req() req: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string
  ) {
    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    const stats = await this.learningRecordsService.getSchoolLearningStats(
      req.user.schoolId,
      filters.startDate,
      filters.endDate
    );
    return stats;
  }

  @Get('student-records')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getStudentRecords(
    @Query('student_id') studentId: string,
    @Query('action') action?: LearningActionType,
    @Query('video_id') videoId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page') page = '1',
    @Query('page_size') pageSize = '20'
  ) {
    const studentIdNum = Number(studentId);
    if (!studentIdNum || isNaN(studentIdNum)) {
      throw new Error('Invalid student_id parameter');
    }

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    const filters = {
      action,
      videoId: videoId ? Number(videoId) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    const result = await this.learningRecordsService.getStudentLearningRecords(
      studentIdNum,
      p,
      ps,
      filters
    );
    return result;
  }

  @Get('student-progress')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getStudentProgress(@Query('student_id') studentId: string) {
    const studentIdNum = Number(studentId);
    if (!studentIdNum || isNaN(studentIdNum)) {
      throw new Error('Invalid student_id parameter');
    }

    const progress = await this.learningRecordsService.getStudentProgress(studentIdNum);
    return progress;
  }

  @Get('student-stats')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getStudentStats(@Query('student_id') studentId: string) {
    const studentIdNum = Number(studentId);
    if (!studentIdNum || isNaN(studentIdNum)) {
      throw new Error('Invalid student_id parameter');
    }

    const stats = await this.learningRecordsService.getStudentStats(studentIdNum);
    return stats;
  }
}