import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { StudentCoachRelation } from './student-coach-relation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, StudentCoachRelation])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}

