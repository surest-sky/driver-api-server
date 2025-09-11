import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Availability } from './availability.entity';

@Injectable()
export class AvailabilityService {
  constructor(@InjectRepository(Availability) private readonly repo: Repository<Availability>) {}

  listForUser(userId: number) {
    return this.repo.find({ where: { userId }, order: { startTime: 'ASC' } });
  }

  async create(userId: number, data: { startTime: Date; endTime: Date; repeat: 'always' | 'once'; isUnavailable?: boolean }) {
    const item = this.repo.create({
      userId,
      startTime: data.startTime,
      endTime: data.endTime,
      repeat: data.repeat,
      isUnavailable: data.isUnavailable ?? true,
    });
    return this.repo.save(item);
  }

  async update(userId: number, id: number, patch: Partial<Availability>) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('记录不存在');
    if (item.userId !== userId) throw new ForbiddenException();
    Object.assign(item, patch);
    return this.repo.save(item);
  }

  async remove(userId: number, id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('记录不存在');
    if (item.userId !== userId) throw new ForbiddenException();
    await this.repo.delete({ id });
    return { success: true };
  }
}

