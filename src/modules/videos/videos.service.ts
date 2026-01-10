import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Video, VideoFavorite, VideoType } from './video.entity';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
    @InjectRepository(VideoFavorite)
    private readonly favoriteRepo: Repository<VideoFavorite>,
  ) {}

  private decorateVideo(video: Video, isFavorite: boolean): Video & { isFavorite: boolean } {
    const enriched = video as Video & { isFavorite: boolean; favorites?: unknown };
    enriched.isFavorite = isFavorite;
    if ('favorites' in enriched) {
      delete enriched.favorites;
    }
    return enriched;
  }

  private async markFavoriteFlags(
    videos: Video[],
    userId?: number,
  ): Promise<Array<Video & { isFavorite: boolean }>> {
    if (videos.length === 0) {
      return [];
    }

    if (!userId) {
      return videos.map(video => this.decorateVideo(video, false));
    }

    const ids = videos.map(video => Number(video.id));
    const favorites = await this.favoriteRepo.find({
      where: { userId, videoId: In(ids) },
      select: ['videoId'],
    });
    const favoriteIds = new Set(favorites.map(item => Number(item.videoId)));

    return videos.map(video => this.decorateVideo(video, favoriteIds.has(Number(video.id))));
  }

  private async markFavoriteFlag(
    video: Video | null,
    userId?: number,
  ): Promise<(Video & { isFavorite: boolean }) | null> {
    if (!video) {
      return null;
    }

    if (!userId) {
      return this.decorateVideo(video, false);
    }

    const isFavorite = await this.favoriteRepo.exists({
      where: { videoId: video.id, userId },
    });

    return this.decorateVideo(video, isFavorite);
  }

  async getRecommendedVideos(
    schoolId: number,
    userId?: number,
    limit: number = 10,
  ): Promise<Array<Video & { isFavorite: boolean }>> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const videos = await this.videoRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.uploader', 'uploader')
      .where('v.schoolId = :schoolId', { schoolId })
      .andWhere('v.isPublished = :isPublished', { isPublished: true })
      .andWhere('v.createdAt >= :since', { since: sevenDaysAgo })
      .orderBy('v.viewCount', 'DESC')
      .addOrderBy('v.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return this.markFavoriteFlags(videos, userId);
  }

  async getVideosByType(
    schoolId: number,
    type: VideoType,
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    userId?: number,
  ) {
    const qb = this.videoRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.uploader', 'uploader')
      .leftJoinAndSelect('v.student', 'student')
      .leftJoinAndSelect('v.coach', 'coach')
      .where('v.schoolId = :schoolId', { schoolId })
      .andWhere('v.type = :type', { type })
      .andWhere('v.isPublished = :isPublished', { isPublished: true });

    if (search && search.trim()) {
      qb.andWhere('(v.title LIKE :search OR v.description LIKE :search)', {
        search: `%${search.trim()}%`,
      });
    }

    qb.orderBy('v.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const decorated = await this.markFavoriteFlags(items, userId);
    return { items: decorated, total, page, pageSize };
  }

  async getVideosByStudentId(
    schoolId: number,
    studentId: number,
    page: number = 1,
    pageSize: number = 20,
    userId?: number,
  ) {
    const qb = this.videoRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.uploader', 'uploader')
      .leftJoinAndSelect('v.student', 'student')
      .where('v.schoolId = :schoolId', { schoolId })
      .andWhere('v.studentId = :studentId', { studentId })
      .andWhere('v.isPublished = :isPublished', { isPublished: true });

    qb.orderBy('v.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const decorated = await this.markFavoriteFlags(items, userId);
    return { items: decorated, total, page, pageSize };
  }

  async getVideoDetail(videoId: number): Promise<Video | null> {
    return this.videoRepo.findOne({
      where: { id: videoId },
      relations: ['uploader', 'student', 'coach', 'school'],
    });
  }

  async getVideoDetailForUser(
    videoId: number,
    userId?: number,
  ): Promise<Video & { isFavorite: boolean }> {
    const video = await this.getVideoDetail(videoId);
    if (!video) {
      throw new NotFoundException('视频不存在');
    }

    const decorated = await this.markFavoriteFlag(video, userId);
    if (!decorated) {
      throw new NotFoundException('视频不存在');
    }

    return decorated;
  }

  async incrementViewCount(videoId: number): Promise<void> {
    await this.videoRepo.increment({ id: videoId }, 'viewCount', 1);
  }

  async searchVideos(
    schoolId: number,
    keyword: string,
    type?: VideoType,
    page: number = 1,
    pageSize: number = 20,
    userId?: number,
  ) {
    const qb = this.videoRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.uploader', 'uploader')
      .where('v.schoolId = :schoolId', { schoolId })
      .andWhere('v.isPublished = :isPublished', { isPublished: true })
      .andWhere('(v.title LIKE :keyword OR v.description LIKE :keyword)', {
        keyword: `%${keyword}%`,
      });

    if (type) {
      qb.andWhere('v.type = :type', { type });
    }

    qb.orderBy('v.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const decorated = await this.markFavoriteFlags(items, userId);
    return { items: decorated, total, page, pageSize };
  }

  async createVideo(data: Partial<Video>): Promise<Video> {
    const video = this.videoRepo.create(data);
    return this.videoRepo.save(video);
  }

  async updateVideo(id: number, data: Partial<Video>): Promise<Video | null> {
    await this.videoRepo.update(id, data);
    return this.getVideoDetail(id);
  }

  async toggleFavorite(
    id: number,
    user: { sub: number; schoolId?: number | null; isManager?: boolean },
  ): Promise<Video & { isFavorite: boolean }> {
    const video = await this.getVideoDetail(id);
    if (!video) {
      throw new NotFoundException('视频不存在');
    }

    const isSameSchool = user.schoolId == null || video.schoolId === user.schoolId;
    const isManager = Boolean(user.isManager);
    if (!isSameSchool && !isManager) {
      throw new ForbiddenException('无权操作该视频');
    }

    const existing = await this.favoriteRepo.findOne({
      where: { videoId: id, userId: user.sub },
      select: ['id'],
    });

    let isFavorite = true;
    if (existing) {
      await this.favoriteRepo.delete(existing.id);
      isFavorite = false;
    } else {
      const favorite = this.favoriteRepo.create({
        videoId: id,
        userId: user.sub,
      });
      await this.favoriteRepo.save(favorite);
      isFavorite = true;
    }

    return this.decorateVideo(video, isFavorite);
  }

  async getFavoriteVideos(
    user: { sub: number; schoolId?: number | null; isManager?: boolean },
    page: number = 1,
    pageSize: number = 20,
  ) {
    const qb = this.favoriteRepo
      .createQueryBuilder('favorite')
      .innerJoinAndSelect('favorite.video', 'video')
      .leftJoinAndSelect('video.uploader', 'uploader')
      .leftJoinAndSelect('video.student', 'student')
      .leftJoinAndSelect('video.coach', 'coach')
      .where('favorite.userId = :userId', { userId: user.sub })
      .orderBy('favorite.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const isManager = Boolean(user.isManager);
    if (!isManager && user.schoolId != null) {
      qb.andWhere('video.schoolId = :schoolId', { schoolId: user.schoolId });
    }

    qb.andWhere('video.isPublished = :isPublished', { isPublished: true });

    const [favorites, total] = await qb.getManyAndCount();
    const items = favorites.map(favorite => this.decorateVideo(favorite.video, true));

    return { items, total, page, pageSize };
  }

  async updateRemark(
    id: number,
    user: { sub: number; role?: string; isManager?: boolean; schoolId?: number | null },
    remark: string,
  ): Promise<Video> {
    const video = await this.videoRepo.findOne({ where: { id } });
    if (!video) {
      throw new NotFoundException('视频不存在');
    }

    const userId = user.sub;
    const isOwner = video.coachId === userId || video.uploadedBy === userId;
    const isManager = Boolean(user.isManager) &&
        (user.schoolId == null || video.schoolId === user.schoolId);

    if (!isOwner && !isManager) {
      throw new ForbiddenException('无权修改备注');
    }

    video.remark = remark.trim();
    await this.videoRepo.save(video);

    return (await this.getVideoDetail(id)) ?? video;
  }

  async deleteVideo(id: number): Promise<boolean> {
    const result = await this.videoRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
