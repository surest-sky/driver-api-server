import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './school.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School) private readonly repo: Repository<School>,
    private readonly users: UsersService,
  ) {}

  async getForCoach(coachId: string) {
    const coach = await this.users.findById(coachId);
    const code = coach?.schoolCode || 'DEFAULT';
    let school = await this.repo.findOne({ where: { code } });
    if (!school) {
      school = this.repo.create({ code, name: coach?.schoolName || '我的驾校' });
      school = await this.repo.save(school);
    }
    
    // 转换字段名以匹配前端模型
    return {
      ...school,
      backgroundImageUrl: school.bannerUrl, // 前端期望 backgroundImageUrl
    };
  }

  async updateForCoach(coachId: string, patch: any) {
    const s = await this.getForCoach(coachId) as any;
    
    // 处理字段映射：前端发送 bannerUrl，后端存储为 bannerUrl
    const updateData: Partial<School> = {
      ...patch,
    };
    
    await this.repo.update({ id: s.id }, updateData);
    const updated = await this.repo.findOne({ where: { id: s.id } });
    
    // 返回时转换字段名以匹配前端模型
    return {
      ...updated,
      backgroundImageUrl: updated?.bannerUrl,
    };
  }
}

