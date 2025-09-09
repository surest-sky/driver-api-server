import { Controller, Get, Param, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from './policy.entity';

@Controller('policies')
export class PoliciesController {
  constructor(@InjectRepository(Policy) private readonly repo: Repository<Policy>) {}

  // 获取某校的政策列表，可按类型/优先级/是否有效过滤
  @Get()
  async list(
    @Query('schoolId') schoolId: string,
    @Query('type') type?: 'rule' | 'notice' | 'announcement',
    @Query('priority') priority?: 'low' | 'normal' | 'high' | 'urgent',
    @Query('isActive') isActive?: '0' | '1'
  ) {
    const where: any = {};
    if (schoolId) where.schoolId = Number(schoolId);
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (isActive !== undefined) where.isActive = isActive === '1';
    const items = await this.repo.find({ where, order: { priority: 'DESC', createdAt: 'DESC' } });
    return { items };
  }

  // 获取单条政策详情
  @Get(':id')
  async detail(@Param('id') id: string) {
    const item = await this.repo.findOne({ where: { id: Number(id) } });
    return item ?? null;
  }
}
