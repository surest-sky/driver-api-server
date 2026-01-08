import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { AppointmentCommentEntity } from './appointment-comment.entity';
import { Availability } from '../availability/availability.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentAutoCompleteService } from './appointment-auto-complete.service';
import { AppointmentRecurrence } from './appointment-recurrence.entity';
import { AppointmentRecurrenceService } from './appointment-recurrence.service';
import { AppointmentRecurrenceController } from './appointment-recurrence.controller';
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentCommentEntity,
      Availability,
      AppointmentRecurrence,
    ]),
    UsersModule,
    MessagesModule,
    NotificationsModule,
  ],
  providers: [
    AppointmentsService,
    AppointmentAutoCompleteService,
    AppointmentRecurrenceService,
  ],
  controllers: [AppointmentsController, AppointmentRecurrenceController],
})
export class AppointmentsModule {}
