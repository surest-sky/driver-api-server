import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Availability } from './availability.entity';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Availability])],
  providers: [AvailabilityService],
  controllers: [AvailabilityController],
  exports: [TypeOrmModule],
})
export class AvailabilityModule {}

