import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoliciesController } from './policies.controller';
import { Policy } from './policy.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Policy])],
  controllers: [PoliciesController],
})
export class PoliciesModule {}

