import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AppointmentRecurrenceService } from './appointment-recurrence.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments/recurring')
export class AppointmentRecurrenceController {
  constructor(private readonly service: AppointmentRecurrenceService) {}

  @Post()
  @Roles('coach')
  create(@Req() req: any, @Body() body: {
    studentId: string;
    startTime: string;
    endTime: string;
    repeat?: 'weekly';
    lastGeneratedAt?: string;
  }) {
    return this.service.createRule({
      coachId: req.user.sub,
      studentId: Number(body.studentId),
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      repeat: body.repeat ?? 'weekly',
      lastGeneratedAt: body.lastGeneratedAt ? new Date(body.lastGeneratedAt) : null,
    });
  }
}
