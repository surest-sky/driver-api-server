import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Appointment, AppointmentStatus, AppointmentType } from './appointment.entity';
import { AppointmentRecurrence } from './appointment-recurrence.entity';
import { User } from '../users/user.entity';
import { CreditRecord } from '../users/credit-record.entity';

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
    const durationMs = data.endTime.getTime() - data.startTime.getTime();
    if (durationMs <= 0) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    return this.dataSource.transaction(async (manager) => {
      const ruleRepo = manager.getRepository(AppointmentRecurrence);
      const appointmentRepo = manager.getRepository(Appointment);
      const studentRepo = manager.getRepository(User);
      const creditRepo = manager.getRepository(CreditRecord);

      const rule = ruleRepo.create({
        coachId: data.coachId,
        studentId: data.studentId,
        startTime: data.startTime,
        endTime: data.endTime,
        repeat: data.repeat,
        lastGeneratedAt: data.lastGeneratedAt ?? null,
        isActive: true,
      });
      await ruleRepo.save(rule);

      const creditsPer = this._calculateCredits(data.startTime, data.endTime);
      const weeksToGenerate = 4;
      const occurrences: Array<{ start: Date; end: Date }> = [];

      for (let i = 0; i < weeksToGenerate; i++) {
        const offset = new Date(data.startTime.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const end = new Date(offset.getTime() + durationMs);
        const exists = await appointmentRepo.findOne({
          where: {
            coachId: data.coachId,
            studentId: data.studentId,
            startTime: offset,
            endTime: end,
          },
        });
        if (!exists) {
          occurrences.push({ start: offset, end });
        }
      }

      const totalCredits = this._roundCredits(creditsPer * occurrences.length);
      if (totalCredits > 0) {
        const lockedStudent = await studentRepo.findOne({
          where: { id: data.studentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!lockedStudent) throw new BadRequestException('学员不存在');

        const newBalance = this._roundCredits(
          Number(lockedStudent.credits || 0) - totalCredits,
        );
        if (newBalance < 0) {
          throw new BadRequestException('积分不足');
        }

        for (const occurrence of occurrences) {
          const appointment = appointmentRepo.create({
            coachId: data.coachId,
            studentId: data.studentId,
            startTime: occurrence.start,
            endTime: occurrence.end,
            status: AppointmentStatus.confirmed,
            type: AppointmentType.regular,
          });
          await appointmentRepo.save(appointment);
        }

        const record = creditRepo.create({
          studentId: data.studentId,
          coachId: data.coachId,
          delta: this._roundCredits(-totalCredits),
          description: this._creditUsageDescription(
            '重复预约预扣',
            data.startTime,
            new Date(data.startTime.getTime() + (weeksToGenerate - 1) * 7 * 24 * 60 * 60 * 1000 + durationMs),
          ),
          balanceAfter: newBalance,
          createdAt: new Date(),
        });
        await creditRepo.save(record);
        await studentRepo.update({ id: data.studentId }, { credits: newBalance });
      }

      if (occurrences.length > 0) {
        rule.lastGeneratedAt = occurrences[occurrences.length - 1].start;
        await ruleRepo.save(rule);
      }

      return rule;
    });
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

      const studentRepo = queryRunner.manager.getRepository(User);
      const creditRepo = queryRunner.manager.getRepository(CreditRecord);

      for (const rule of rules) {
        try {
          const durationMs = rule.endTime.getTime() - rule.startTime.getTime();
          if (durationMs <= 0) continue;
          const creditsPer = this._calculateCredits(rule.startTime, rule.endTime);

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
              const lockedStudent = await studentRepo.findOne({
                where: { id: rule.studentId },
                lock: { mode: 'pessimistic_write' },
              });
              if (!lockedStudent) {
                failedRules.push(rule.id);
                break;
              }

              const newBalance = this._roundCredits(
                Number(lockedStudent.credits || 0) - creditsPer,
              );
              if (newBalance < 0) {
                this.logger.warn(`Insufficient credits for rule ${rule.id}`);
                break;
              }

              const appointment = queryRunner.manager.create(Appointment, {
                coachId: rule.coachId,
                studentId: rule.studentId,
                startTime: next,
                endTime: end,
                status: AppointmentStatus.confirmed,
                type: AppointmentType.regular,
              });
              await queryRunner.manager.save(appointment);

              const record = creditRepo.create({
                studentId: rule.studentId,
                coachId: rule.coachId,
                delta: this._roundCredits(-creditsPer),
                description: this._creditUsageDescription(
                  '重复预约扣减',
                  next,
                  end,
                ),
                balanceAfter: newBalance,
                createdAt: new Date(),
              });
              await creditRepo.save(record);
              await studentRepo.update({ id: rule.studentId }, { credits: newBalance });

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

  private _roundCredits(value: number) {
    return Number(Number(value || 0).toFixed(2));
  }

  private _calculateCredits(startTime: Date, endTime: Date) {
    const minutes = (endTime.getTime() - startTime.getTime()) / 60000;
    return this._roundCredits(minutes / 60);
  }

  private _formatTimeLabel(date: Date) {
    const pad = (value: number) => value.toString().padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${y}-${m}-${d} ${h}:${min}`;
  }

  private _creditUsageDescription(prefix: string, startTime: Date, endTime: Date) {
    const start = this._formatTimeLabel(startTime);
    const end = this._formatTimeLabel(endTime);
    return `${prefix}（${start} - ${end}）`;
  }
}
