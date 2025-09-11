import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { AppointmentCommentEntity } from './appointment-comment.entity';
import { Availability } from '../availability/availability.entity';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, AppointmentCommentEntity, Availability]), UsersModule, MessagesModule],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
