import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { VideoCommentsService } from './video-comments.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { IsNotEmpty, IsOptional, IsInt } from 'class-validator';

class CreateCommentDto {
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsInt()
  parentId?: number;
}

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideoCommentsController {
  constructor(private readonly commentsService: VideoCommentsService) {}

  @Get(':videoId/comments')
  async getComments(
    @Param('videoId', ParseIntPipe) videoId: number,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.commentsService.getCommentsByVideo(
      videoId,
      page || 1,
      pageSize || 20,
    );
  }

  @Post(':videoId/comments')
  async createComment(
    @Req() req: any,
    @Param('videoId', ParseIntPipe) videoId: number,
    @Body() dto: CreateCommentDto,
  ) {
    const user = req.user;
    const comment = await this.commentsService.createComment(
      videoId,
      user.sub,
      user.name || user.username || '未知用户',
      user.role || 'student',
      dto.content,
      dto.parentId,
    );
    return comment;
  }

  @Delete('comments/:id')
  async deleteComment(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const user = req.user;
    const success = await this.commentsService.deleteComment(id, user.sub);
    return { success, message: success ? '删除成功' : '删除失败' };
  }
}
