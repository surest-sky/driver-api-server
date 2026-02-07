import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { Invite } from './invite.entity';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/user.entity';
import { StudentCoachRelation } from '../users/student-coach-relation.entity';
import { School } from '../schools/school.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invite, User, StudentCoachRelation, School]),
    MessagesModule,
    UsersModule,
  ],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
