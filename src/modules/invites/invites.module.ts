import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { Invite } from './invite.entity';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Invite]), MessagesModule, UsersModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}

