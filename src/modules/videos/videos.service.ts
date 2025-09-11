import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like } from 'typeorm';
import { Video, VideoNote, VideoInteraction, VideoStatus, InteractionType } from './video.entity';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video) 
    private readonly videoRepo: Repository<Video>,
    @InjectRepository(VideoNote) 
    private readonly noteRepo: Repository<VideoNote>,
    @InjectRepository(VideoInteraction) 
    private readonly interactionRepo: Repository<VideoInteraction>,
  ) {}

  async createVideo(data: Partial<Video>): Promise<Video> {
    const video = this.videoRepo.create(data);
    return this.videoRepo.save(video);
  }

  async findById(id: number): Promise<Video | null> {
    return this.videoRepo.findOne({
      where: { id },
      relations: ['coach', 'student', 'school', 'videoNotes', 'videoNotes.author']
    });
  }

  async updateVideo(id: number, data: Partial<Video>): Promise<Video | null> {
    await this.videoRepo.update(id, data);
    return this.findById(id);
  }

  async deleteVideo(id: number): Promise<boolean> {
    const result = await this.videoRepo.update(id, { status: VideoStatus.deleted });
    return result.affected === 1;
  }

  async listVideosBySchool(
    schoolId: number, 
    page: number = 1, 
    pageSize: number = 20,
    filters?: {
      coachId?: number;
      studentId?: number;
      status?: VideoStatus;
      search?: string;
      sortBy?: 'created_at' | 'sort_order' | 'view_count' | 'like_count';
      sortOrder?: 'ASC' | 'DESC';
    }
  ) {
    const qb = this.videoRepo.createQueryBuilder('v')
      .leftJoinAndSelect('v.coach', 'coach')
      .leftJoinAndSelect('v.student', 'student')
      .leftJoinAndSelect('v.school', 'school')
      .where('v.schoolId = :schoolId', { schoolId })
      .andWhere('v.status != :deletedStatus', { deletedStatus: VideoStatus.deleted });

    if (filters?.coachId) {
      qb.andWhere('v.coachId = :coachId', { coachId: filters.coachId });
    }

    if (filters?.studentId) {
      qb.andWhere('v.studentId = :studentId', { studentId: filters.studentId });
    }

    if (filters?.status) {
      qb.andWhere('v.status = :status', { status: filters.status });
    }

    if (filters?.search && filters.search.trim()) {
      qb.andWhere('(v.title LIKE :search OR v.description LIKE :search)', 
        { search: `%${filters.search.trim()}%` });
    }

    // 排序
    const sortBy = filters?.sortBy || 'created_at';
    const sortOrder = filters?.sortOrder || 'DESC';
    qb.orderBy(`v.${sortBy}`, sortOrder);

    // 分页
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  // Reddit算法推荐视频
  async getRecommendedVideos(
    schoolId: number,
    userId?: number,
    limit: number = 10
  ): Promise<Video[]> {
    const hoursAgo24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hoursAgo7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Reddit算法: score = (ups - downs) / (time_diff + 2)^1.5
    // 这里简化为: score = (like_count + view_count * 0.1) / (hours_since_creation + 2)^1.5
    const qb = this.videoRepo.createQueryBuilder('v')
      .leftJoinAndSelect('v.coach', 'coach')
      .leftJoinAndSelect('v.student', 'student')
      .where('v.schoolId = :schoolId', { schoolId })
      .andWhere('v.status = :status', { status: VideoStatus.ready })
      .andWhere('v.isPublic = :isPublic', { isPublic: true })
      .andWhere('v.createdAt >= :since', { since: hoursAgo7Days })
      .addSelect(`
        (v.like_count + v.view_count * 0.1) / 
        POWER(TIMESTAMPDIFF(HOUR, v.created_at, NOW()) + 2, 1.5)
      `, 'reddit_score')
      .orderBy('reddit_score', 'DESC')
      .limit(limit);

    return qb.getMany();
  }

  async addVideoNote(videoId: number, authorId: number, content: string, timestampSeconds: number): Promise<VideoNote> {
    const note = this.noteRepo.create({
      videoId,
      authorId,
      content,
      timestampSeconds
    });
    return this.noteRepo.save(note);
  }

  async getVideoNotes(videoId: number): Promise<VideoNote[]> {
    return this.noteRepo.find({
      where: { videoId },
      relations: ['author'],
      order: { timestampSeconds: 'ASC' }
    });
  }

  async deleteVideoNote(noteId: number, authorId: number): Promise<boolean> {
    const result = await this.noteRepo.delete({ id: noteId, authorId });
    return result.affected === 1;
  }

  async toggleInteraction(videoId: number, userId: number, type: InteractionType): Promise<boolean> {
    const existing = await this.interactionRepo.findOne({
      where: { videoId, userId, type }
    });

    if (existing) {
      existing.active = !existing.active;
      await this.interactionRepo.save(existing);
      
      // 更新视频统计
      if (type === InteractionType.like) {
        await this.updateLikeCount(videoId);
      }
      
      return existing.active;
    } else {
      const interaction = this.interactionRepo.create({
        videoId,
        userId,
        type,
        active: true
      });
      await this.interactionRepo.save(interaction);

      // 更新视频统计
      if (type === InteractionType.like) {
        await this.updateLikeCount(videoId);
      } else if (type === InteractionType.view) {
        await this.incrementViewCount(videoId);
      }

      return true;
    }
  }

  async incrementViewCount(videoId: number): Promise<void> {
    await this.videoRepo.increment({ id: videoId }, 'viewCount', 1);
  }

  private async updateLikeCount(videoId: number): Promise<void> {
    const likeCount = await this.interactionRepo.count({
      where: { videoId, type: InteractionType.like, active: true }
    });
    await this.videoRepo.update(videoId, { likeCount });
  }

  async updateSortOrder(videoId: number, sortOrder: number): Promise<Video | null> {
    await this.videoRepo.update(videoId, { sortOrder });
    return this.findById(videoId);
  }

  async getVideoStats(schoolId: number, coachId?: number) {
    const where: FindOptionsWhere<Video> = { 
      schoolId,
      status: VideoStatus.ready 
    };
    
    if (coachId) {
      where.coachId = coachId;
    }

    const [totalVideos, totalViews, totalLikes] = await Promise.all([
      this.videoRepo.count({ where }),
      this.videoRepo.sum('viewCount', where),
      this.videoRepo.sum('likeCount', where)
    ]);

    return {
      totalVideos,
      totalViews: totalViews || 0,
      totalLikes: totalLikes || 0
    };
  }
}