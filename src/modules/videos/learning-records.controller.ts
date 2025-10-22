import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { LearningRecordsService } from './learning-records.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { IsNotEmpty, IsInt, Min } from 'class-validator';

class UpdateProgressDto {
  @IsNotEmpty()
  @IsInt()
  videoId!: number;

  @IsInt()
  @Min(0)
  position!: number;

  @IsInt()
  @Min(1)
  duration!: number;
}

@Controller('learning-records')
@UseGuards(JwtAuthGuard)
export class LearningRecordsController {
  constructor(private readonly recordsService: LearningRecordsService) {}

  @Post('progress')
  async updateProgress(@Req() req: any, @Body() dto: UpdateProgressDto) {
    const user = req.user;
    const record = await this.recordsService.updateProgress(
      user.sub,
      dto.videoId,
      dto.position,
      dto.duration,
    );
    return record;
  }

  @Get('my')
  async getMyLearningRecords(
    @Req() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    const user = req.user;
    return this.recordsService.getMyLearningRecords(
      user.sub,
      page || 1,
      pageSize || 20,
    );
  }

  @Get('recently-watched')
  async getRecentlyWatched(
    @Req() req: any,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const user = req.user;
    const records = await this.recordsService.getRecentlyWatchedVideos(
      user.sub,
      limit || 10,
    );
    return { records };
  }

  @Get('in-progress')
  async getInProgressVideos(
    @Req() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    const user = req.user;
    return this.recordsService.getInProgressVideos(
      user.sub,
      page || 1,
      pageSize || 20,
    );
  }

  @Get('completed')
  async getCompletedVideos(
    @Req() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    const user = req.user;
    return this.recordsService.getCompletedVideos(
      user.sub,
      page || 1,
      pageSize || 20,
    );
  }

  @Get(':videoId')
  async getVideoProgress(
    @Req() req: any,
    @Param('videoId', ParseIntPipe) videoId: number,
  ) {
    const user = req.user;
    const record = await this.recordsService.getRecordByUserAndVideo(
      user.sub,
      videoId,
    );
    return record || { message: '暂无学习记录' };
  }
}
