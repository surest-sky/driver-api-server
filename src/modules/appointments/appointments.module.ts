import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { AppointmentCommentEntity } from './appointment-comment.entity';
import { Availability } from '../availability/availability.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentAutoCompleteService } from './appointment-auto-complete.service';
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, AppointmentCommentEntity, Availability]),
    UsersModule,
    MessagesModule,
    NotificationsModule,
  ],
  providers: [AppointmentsService, AppointmentAutoCompleteService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
