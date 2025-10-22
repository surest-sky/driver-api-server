import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoComment } from './video.entity';

@Injectable()
export class VideoCommentsService {
  constructor(
    @InjectRepository(VideoComment)
    private readonly commentRepo: Repository<VideoComment>,
  ) {}

  async getCommentsByVideo(
    videoId: number,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const qb = this.commentRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .leftJoinAndSelect('c.replies', 'replies')
      .leftJoinAndSelect('replies.user', 'replyUser')
      .where('c.videoId = :videoId', { videoId })
      .andWhere('c.parentId IS NULL') // 只获取顶级评论
      .orderBy('c.createdAt', 'DESC')
      .addOrderBy('replies.createdAt', 'ASC') // 回复按时间升序
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async createComment(
    videoId: number,
    userId: number,
    userName: string,
    userRole: string,
    content: string,
    parentId?: number,
  ): Promise<VideoComment> {
    // 如果有 parentId，验证父评论是否存在且属于同一视频
    if (parentId) {
      const parentComment = await this.commentRepo.findOne({
        where: { id: parentId },
      });

      if (!parentComment) {
        throw new NotFoundException('父评论不存在');
      }

      if (parentComment.videoId !== videoId) {
        throw new ForbiddenException('父评论不属于当前视频');
      }
    }

    const comment = this.commentRepo.create({
      videoId,
      userId,
      userName,
      userRole,
      content: content.trim(),
      parentId,
    });

    return this.commentRepo.save(comment);
  }

  async deleteComment(commentId: number, userId: number): Promise<boolean> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    // 只能删除自己的评论
    if (comment.userId !== userId) {
      throw new ForbiddenException('只能删除自己的评论');
    }

    const result = await this.commentRepo.delete(commentId);
    return (result.affected ?? 0) > 0;
  }

  async getCommentById(commentId: number): Promise<VideoComment | null> {
    return this.commentRepo.findOne({
      where: { id: commentId },
      relations: ['user', 'video', 'parent', 'replies'],
    });
  }
}
