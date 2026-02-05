import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountDeletion } from './account-deletion.entity';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionController } from './account-deletion.controller';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccountDeletion, User])],
  providers: [AccountDeletionService],
  controllers: [AccountDeletionController],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
