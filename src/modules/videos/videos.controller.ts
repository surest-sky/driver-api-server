import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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

class UpdateRemarkDto {
  @IsString()
  remark!: string;
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
    @Query('type') type?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
    @Query('search') search?: string,
    @Query('studentId', new ParseIntPipe({ optional: true })) studentId?: number,
  ) {
    const user = req.user;

    // 手动转换 type
    const videoType = type && (type === 'teaching' || type === 'recording')
      ? (type as VideoType)
      : undefined;

    if (studentId) {
      return this.videosService.getVideosByStudentId(
        user.schoolId,
        studentId,
        page || 1,
        pageSize || 20,
        user.sub,
      );
    }

    if (videoType) {
      return this.videosService.getVideosByType(
        user.schoolId,
        videoType,
        page || 1,
        pageSize || 20,
        search,
        user.sub,
      );
    }

    if (search) {
      return this.videosService.searchVideos(
        user.schoolId,
        search,
        undefined,
        page || 1,
        pageSize || 20,
        user.sub,
      );
    }

    // 默认返回所有教学视频
    return this.videosService.getVideosByType(
      user.schoolId,
      VideoType.teaching,
      page || 1,
      pageSize || 20,
      undefined,
      user.sub,
    );
  }

  @Get('favorites')
  async getFavorites(
    @Req() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    const user = req.user;
    return this.videosService.getFavoriteVideos(
      user,
      page || 1,
      pageSize || 20,
    );
  }

  @Get(':id')
  async getVideoDetail(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.videosService.getVideoDetailForUser(id, req.user?.sub);
  }

  @Post(':id/favorite')
  async toggleFavorite(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.videosService.toggleFavorite(id, req.user);
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

  @Patch(':id/remark')
  async updateRemark(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRemarkDto,
  ) {
    return this.videosService.updateRemark(id, req.user, dto.remark ?? '');
  }

  @Delete(':id')
  async deleteVideo(@Param('id', ParseIntPipe) id: number) {
    const success = await this.videosService.deleteVideo(id);
    return { success, message: success ? '删除成功' : '删除失败' };
  }
}
