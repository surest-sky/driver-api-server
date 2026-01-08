import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus, AppointmentType } from './appointment.entity';
import { AppointmentRecurrence } from './appointment-recurrence.entity';

@Injectable()
export class AppointmentRecurrenceService {
  private readonly logger = new Logger(AppointmentRecurrenceService.name);

  constructor(
    @InjectRepository(AppointmentRecurrence)
    private readonly repo: Repository<AppointmentRecurrence>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
  ) {}

  async createRule(data: {
    coachId: number;
    studentId: number;
    startTime: Date;
    endTime: Date;
    repeat: 'weekly';
    lastGeneratedAt?: Date | null;
  }) {
    const rule = this.repo.create({
      coachId: data.coachId,
      studentId: data.studentId,
      startTime: data.startTime,
      endTime: data.endTime,
      repeat: data.repeat,
      lastGeneratedAt: data.lastGeneratedAt ?? null,
      isActive: true,
    });
    return this.repo.save(rule);
  }

  async generateNextWeek(): Promise<{ created: number }> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rules = await this.repo.find({ where: { isActive: true } });
    let created = 0;

    for (const rule of rules) {
      const durationMs = rule.endTime.getTime() - rule.startTime.getTime();
      if (durationMs <= 0) {
        continue;
      }

      let next = rule.lastGeneratedAt ?? rule.startTime;
      while (next.getTime() + durationMs < now.getTime()) {
        next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      let latest = rule.lastGeneratedAt ?? rule.startTime;
      while (next <= windowEnd) {
        const end = new Date(next.getTime() + durationMs);
        const exists = await this.appointmentRepo.findOne({
          where: {
            coachId: rule.coachId,
            studentId: rule.studentId,
            startTime: next,
            endTime: end,
          },
        });

        if (!exists) {
          const appointment = this.appointmentRepo.create({
            coachId: rule.coachId,
            studentId: rule.studentId,
            startTime: next,
            endTime: end,
            status: AppointmentStatus.pending,
            type: AppointmentType.regular,
          });
          await this.appointmentRepo.save(appointment);
          created += 1;
        }

        latest = next;
        next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      if (!rule.lastGeneratedAt || latest > rule.lastGeneratedAt) {
        rule.lastGeneratedAt = latest;
        await this.repo.save(rule);
      }
    }

    this.logger.log(`重复预约生成完成，新增 ${created} 条`);
    return { created };
  }
}
