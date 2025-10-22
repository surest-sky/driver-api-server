import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Video, VideoType } from './video.entity';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepo: Repository<Video>,
  ) {}

  async getRecommendedVideos(schoolId: number, userId?: number, limit: number = 10): Promise<Video[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return this.videoRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.uploader', 'uploader')
      .where('v.schoolId = :schoolId', { schoolId })
      .andWhere('v.isPublished = :isPublished', { isPublished: true })
      .andWhere('v.createdAt >= :since', { since: sevenDaysAgo })
      .orderBy('v.viewCount', 'DESC')
      .addOrderBy('v.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async getVideosByType(
    schoolId: number,
    type: VideoType,
    page: number = 1,
    pageSize: number = 20,
    search?: string
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
    return { items, total, page, pageSize };
  }

  async getVideoDetail(videoId: number): Promise<Video | null> {
    return this.videoRepo.findOne({
      where: { id: videoId },
      relations: ['uploader', 'student', 'coach', 'school'],
    });
  }

  async incrementViewCount(videoId: number): Promise<void> {
    await this.videoRepo.increment({ id: videoId }, 'viewCount', 1);
  }

  async searchVideos(
    schoolId: number,
    keyword: string,
    type?: VideoType,
    page: number = 1,
    pageSize: number = 20
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
    return { items, total, page, pageSize };
  }

  async createVideo(data: Partial<Video>): Promise<Video> {
    const video = this.videoRepo.create(data);
    return this.videoRepo.save(video);
  }

  async updateVideo(id: number, data: Partial<Video>): Promise<Video | null> {
    await this.videoRepo.update(id, data);
    return this.getVideoDetail(id);
  }

  async deleteVideo(id: number): Promise<boolean> {
    const result = await this.videoRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
