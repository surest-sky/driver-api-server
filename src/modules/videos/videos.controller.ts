import { 
  Body, 
  Controller, 
  Delete, 
  Get, 
  Param, 
  Patch, 
  Post, 
  Query, 
  Req, 
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseIntPipe
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { VideoStatus, InteractionType } from './video.entity';
import { IsNotEmpty, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';

class CreateVideoDto {
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  description?: string;

  @IsNotEmpty()
  filePath!: string;

  @IsOptional()
  thumbnailPath?: string;

  @IsNumber()
  @Min(0)
  durationSeconds!: number;

  @IsOptional()
  studentId?: number;

  @IsOptional()
  notes?: string;

  @IsOptional()
  recordedAt?: string;
}

class UpdateVideoDto {
  @IsOptional()
  title?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  @IsEnum(VideoStatus)
  status?: VideoStatus;

  @IsOptional()
  studentId?: number;

  @IsOptional()
  notes?: string;

  @IsOptional()
  isPublic?: boolean;

  @IsOptional()
  sortOrder?: number;
}

class AddVideoNoteDto {
  @IsNotEmpty()
  content!: string;

  @IsNumber()
  @Min(0)
  timestampSeconds!: number;
}

class VideoInteractionDto {
  @IsEnum(InteractionType)
  type!: InteractionType;
}

@UseGuards(JwtAuthGuard)
@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('coach')
  async createVideo(@Req() req: any, @Body() dto: CreateVideoDto) {
    const videoData = {
      ...dto,
      coachId: req.user.sub,
      schoolId: req.user.schoolId,
      recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
    };

    const video = await this.videosService.createVideo(videoData);
    return video;
  }

  @Get()
  async listVideos(
    @Req() req: any,
    @Query('school_id') schoolId: string,
    @Query('coach_id') coachId?: string,
    @Query('student_id') studentId?: string,
    @Query('status') status?: VideoStatus,
    @Query('search') search?: string,
    @Query('sort_by') sortBy?: 'created_at' | 'sort_order' | 'view_count' | 'like_count',
    @Query('sort_order') sortOrder?: 'ASC' | 'DESC',
    @Query('page') page = '1',
    @Query('page_size') pageSize = '20'
  ) {
    const schoolIdNum = Number(schoolId);
    if (!schoolIdNum || isNaN(schoolIdNum)) {
      throw new Error('Invalid school_id parameter');
    }

    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;

    const filters = {
      coachId: coachId ? Number(coachId) : undefined,
      studentId: studentId ? Number(studentId) : undefined,
      status,
      search,
      sortBy,
      sortOrder: sortOrder as 'ASC' | 'DESC'
    };

    const result = await this.videosService.listVideosBySchool(schoolIdNum, p, ps, filters);
    return result;
  }

  @Get('recommended')
  async getRecommendedVideos(
    @Req() req: any,
    @Query('school_id') schoolId: string,
    @Query('limit') limit = '10'
  ) {
    const schoolIdNum = Number(schoolId);
    if (!schoolIdNum || isNaN(schoolIdNum)) {
      throw new Error('Invalid school_id parameter');
    }

    const limitNum = Number(limit) || 10;
    const videos = await this.videosService.getRecommendedVideos(
      schoolIdNum,
      req.user.sub,
      limitNum
    );
    return videos;
  }

  @Get('stats')
  async getVideoStats(
    @Req() req: any,
    @Query('school_id') schoolId: string,
    @Query('coach_id') coachId?: string
  ) {
    const schoolIdNum = Number(schoolId);
    if (!schoolIdNum || isNaN(schoolIdNum)) {
      throw new Error('Invalid school_id parameter');
    }

    const coachIdNum = coachId ? Number(coachId) : undefined;
    const stats = await this.videosService.getVideoStats(schoolIdNum, coachIdNum);
    return stats;
  }

  @Get(':id')
  async getVideo(@Param('id', ParseIntPipe) id: number) {
    const video = await this.videosService.findById(id);
    if (!video) {
      throw new Error('Video not found');
    }
    return video;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async updateVideo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVideoDto
  ) {
    const video = await this.videosService.updateVideo(id, dto);
    if (!video) {
      throw new Error('Video not found');
    }
    return video;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async deleteVideo(@Param('id', ParseIntPipe) id: number) {
    const success = await this.videosService.deleteVideo(id);
    if (!success) {
      throw new Error('Video not found');
    }
    return { message: 'Video deleted successfully' };
  }

  @Post(':id/notes')
  async addVideoNote(
    @Req() req: any,
    @Param('id', ParseIntPipe) videoId: number,
    @Body() dto: AddVideoNoteDto
  ) {
    const note = await this.videosService.addVideoNote(
      videoId,
      req.user.sub,
      dto.content,
      dto.timestampSeconds
    );
    return note;
  }

  @Get(':id/notes')
  async getVideoNotes(@Param('id', ParseIntPipe) videoId: number) {
    const notes = await this.videosService.getVideoNotes(videoId);
    return notes;
  }

  @Delete('notes/:noteId')
  async deleteVideoNote(
    @Req() req: any,
    @Param('noteId', ParseIntPipe) noteId: number
  ) {
    const success = await this.videosService.deleteVideoNote(noteId, req.user.sub);
    if (!success) {
      throw new Error('Note not found or permission denied');
    }
    return { message: 'Note deleted successfully' };
  }

  @Post(':id/interactions')
  async toggleInteraction(
    @Req() req: any,
    @Param('id', ParseIntPipe) videoId: number,
    @Body() dto: VideoInteractionDto
  ) {
    const isActive = await this.videosService.toggleInteraction(
      videoId,
      req.user.sub,
      dto.type
    );
    return { type: dto.type, active: isActive };
  }

  @Post(':id/view')
  async recordView(@Param('id', ParseIntPipe) videoId: number) {
    await this.videosService.incrementViewCount(videoId);
    return { message: 'View recorded' };
  }

  @Patch(':id/sort-order')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async updateSortOrder(
    @Param('id', ParseIntPipe) videoId: number,
    @Body('sortOrder') sortOrder: number
  ) {
    const video = await this.videosService.updateSortOrder(videoId, sortOrder);
    if (!video) {
      throw new Error('Video not found');
    }
    return video;
  }
}