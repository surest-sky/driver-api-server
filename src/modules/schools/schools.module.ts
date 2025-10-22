import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolsController, SchoolsPublicController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { School } from './school.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([School]), UsersModule],
  controllers: [SchoolsController, SchoolsPublicController],
  providers: [SchoolsService],
})
export class SchoolsModule {}
