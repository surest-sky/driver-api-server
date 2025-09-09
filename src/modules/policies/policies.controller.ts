import { Controller, Get, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from './policy.entity';

@Controller('policies')
export class PoliciesController {
  constructor(@InjectRepository(Policy) private readonly repo: Repository<Policy>) {}

  @Get(':key')
  async get(@Param('key') key: string) {
    const record = await this.repo.findOne({ where: { key }, order: { id: 'DESC' } });
    return { key, content: record?.content ?? '' };
  }
}

