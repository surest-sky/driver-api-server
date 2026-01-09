import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
    private readonly dataSource: DataSource,
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
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // 使用事务中的 repository
      const rules = await queryRunner.manager.find(AppointmentRecurrence, {
        where: { isActive: true }
      });

      let created = 0;
      const failedRules: number[] = [];

      for (const rule of rules) {
        try {
          const durationMs = rule.endTime.getTime() - rule.startTime.getTime();
          if (durationMs <= 0) continue;

          let next = rule.lastGeneratedAt ?? rule.startTime;
          while (next.getTime() + durationMs < now.getTime()) {
            next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
          }

          let latest = rule.lastGeneratedAt ?? rule.startTime;
          while (next <= windowEnd) {
            const end = new Date(next.getTime() + durationMs);

            // 检查是否已存在（使用事务查询）
            const exists = await queryRunner.manager.findOne(Appointment, {
              where: {
                coachId: rule.coachId,
                studentId: rule.studentId,
                startTime: next,
                endTime: end,
              },
            });

            if (!exists) {
              const appointment = queryRunner.manager.create(Appointment, {
                coachId: rule.coachId,
                studentId: rule.studentId,
                startTime: next,
                endTime: end,
                status: AppointmentStatus.pending,
                type: AppointmentType.regular,
              });
              await queryRunner.manager.save(appointment);
              created += 1;
            }

            latest = next;
            next = new Date(next.getTime() + 7 * 24 * 60 * 60 * 1000);
          }

          if (!rule.lastGeneratedAt || latest > rule.lastGeneratedAt) {
            rule.lastGeneratedAt = latest;
            await queryRunner.manager.save(rule);
          }
        } catch (error) {
          this.logger.error(`Failed to process rule ${rule.id}: ${error.message}`);
          failedRules.push(rule.id);
        }
      }

      await queryRunner.commitTransaction();

      if (failedRules.length > 0) {
        this.logger.warn(`Some rules failed: ${failedRules.join(', ')}`);
      }

      this.logger.log(`Recurring appointments generated, ${created} new`);
      return { created };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transaction rolled back: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
