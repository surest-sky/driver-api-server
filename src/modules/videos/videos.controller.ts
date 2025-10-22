import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { VideoType } from './video.entity';
import { IsNotEmpty, IsOptional, IsEnum, IsString, IsInt, Min } from 'class-validator';

class CreateVideoDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  videoUrl!: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsInt()
  @Min(0)
  duration!: number;

  @IsEnum(VideoType)
  type!: VideoType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsInt()
  studentId?: number;

  @IsOptional()
  @IsInt()
  coachId?: number;
}

class UpdateVideoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @IsOptional()
  @IsEnum(VideoType)
  type?: VideoType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsInt()
  studentId?: number;

  @IsOptional()
  @IsInt()
  coachId?: number;

  @IsOptional()
  isPublished?: boolean;
}

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get('recommended')
  async getRecommendedVideos(
    @Req() req: any,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const user = req.user;
    const videos = await this.videosService.getRecommendedVideos(
      user.schoolId,
      user.sub,
      limit || 10,
    );
    return { videos };
  }

  @Get()
  async getVideoList(
    @Req() req: any,
    @Query('type') type?: VideoType,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
    @Query('search') search?: string,
  ) {
    const user = req.user;

    if (type) {
      return this.videosService.getVideosByType(
        user.schoolId,
        type,
        page || 1,
        pageSize || 20,
        search,
      );
    }

    if (search) {
      return this.videosService.searchVideos(
        user.schoolId,
        search,
        undefined,
        page || 1,
        pageSize || 20,
      );
    }

    // 默认返回所有教学视频
    return this.videosService.getVideosByType(
      user.schoolId,
      VideoType.teaching,
      page || 1,
      pageSize || 20,
    );
  }

  @Get(':id')
  async getVideoDetail(@Param('id', ParseIntPipe) id: number) {
    return this.videosService.getVideoDetail(id);
  }

  @Post(':id/view')
  async recordView(@Param('id', ParseIntPipe) id: number) {
    await this.videosService.incrementViewCount(id);
    return { message: '观看记录已更新' };
  }

  @Post()
  async createVideo(@Req() req: any, @Body() dto: CreateVideoDto) {
    const user = req.user;
    const video = await this.videosService.createVideo({
      ...dto,
      schoolId: user.schoolId,
      uploadedBy: user.sub,
      isPublished: true,
    });
    return video;
  }

  @Put(':id')
  async updateVideo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.videosService.updateVideo(id, dto);
  }

  @Delete(':id')
  async deleteVideo(@Param('id', ParseIntPipe) id: number) {
    const success = await this.videosService.deleteVideo(id);
    return { success, message: success ? '删除成功' : '删除失败' };
  }
}
