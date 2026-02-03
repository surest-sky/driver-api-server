import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from './appointment.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AUTO_CANCEL_TITLE,
  buildAutoCancelCoachContent,
  buildAutoCancelStudentContent,
} from './appointment-notification.constants';

/**
 * Appointment maintenance task: can be triggered by scripts or other entry points.
 */
@Injectable()
export class AppointmentAutoCompleteService {
  private readonly logger = new Logger(AppointmentAutoCompleteService.name);
  private running = false;

  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    private readonly notifications: NotificationsService,
  ) {}

  private resolveDelayMinutes(): number {
    const delay = Number(process.env.APPOINTMENT_AUTO_COMPLETE_DELAY_MINUTES);
    if (!Number.isNaN(delay) && delay >= 0) {
      return delay;
    }
    return 5; // Default delay: 5 minutes to avoid immediate completion.
  }

  private resolveBatchSize(): number {
    const batch = Number(process.env.APPOINTMENT_AUTO_COMPLETE_BATCH_SIZE);
    if (!Number.isNaN(batch) && batch > 0) {
      return Math.min(batch, 500);
    }
    return 100;
  }

  private resolvePendingTimeoutMinutes(): number {
    const value = Number(process.env.APPOINTMENT_AUTO_CANCEL_PENDING_MINUTES);
    if (!Number.isNaN(value) && value > 0) {
      return value;
    }
    return 24 * 60; // Default: 24 hours.
  }

  async runMaintenance(): Promise<{ completed: number; cancelled: number }> {
    if (this.running) {
      this.logger.warn('Maintenance task already running, skipping this request');
      return { completed: 0, cancelled: 0 };
    }
    this.running = true;
    try {
      const completed = await this.completeExpired();
      const cancelled = await this.cancelStalePendingAppointments();
      this.logger.log(
        `Maintenance completed: ${completed} completed, ${cancelled} cancelled`,
      );
      return { completed, cancelled };
    } catch (error) {
      const err = error as Error;
      const message = err?.message ?? String(error);
      this.logger.error(`Auto-complete task failed: ${message}`, err?.stack);
      throw err;
    } finally {
      this.running = false;
    }
  }

  private async completeExpired(): Promise<number> {
    const delayMinutes = this.resolveDelayMinutes();
    const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000);
    const batchSize = this.resolveBatchSize();
    let processed = 0;

    while (true) {
      const toComplete = await this.repo.find({
        where: {
          status: AppointmentStatus.confirmed,
          endTime: LessThanOrEqual(cutoff),
        },
        order: { endTime: 'ASC' },
        take: batchSize,
      });

      if (toComplete.length === 0) {
        break;
      }

      for (const appointment of toComplete) {
        appointment.status = AppointmentStatus.completed;
      }

      await this.repo.save(toComplete);
      processed += toComplete.length;

      if (toComplete.length < batchSize) {
        break;
      }
    }

    return processed;
  }

  private async cancelStalePendingAppointments(): Promise<number> {
    const timeoutMinutes = this.resolvePendingTimeoutMinutes();
    const cutoffCreatedAt = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const now = new Date();
    const batchSize = this.resolveBatchSize();
    let processed = 0;

    while (true) {
      const toCancel = await this.repo
        .createQueryBuilder('appointment')
        .leftJoinAndSelect('appointment.student', 'student')
        .leftJoinAndSelect('appointment.coach', 'coach')
        .where('appointment.status = :status', { status: AppointmentStatus.pending })
        .andWhere(
          '(appointment.createdAt <= :cutoffCreated OR appointment.startTime <= :now)',
          {
            cutoffCreated: cutoffCreatedAt,
            now,
          },
        )
        .orderBy('appointment.createdAt', 'ASC')
        .take(batchSize)
        .getMany();

      if (toCancel.length === 0) {
        break;
      }

      for (const appointment of toCancel) {
        appointment.status = AppointmentStatus.cancelled;
      }

      await this.repo.save(toCancel);
      processed += toCancel.length;

      for (const appointment of toCancel) {
        await this.sendAutoCancelNotificationsSafely(appointment);
      }

      if (toCancel.length < batchSize) {
        break;
      }
    }

    return processed;
  }

  private async sendAutoCancelNotificationsSafely(appointment: Appointment): Promise<void> {
    try {
      const studentId = appointment.studentId;
      const coachId = appointment.coachId;

      if (studentId) {
        await this.notifications.sendSystemNotification(
          studentId,
          AUTO_CANCEL_TITLE,
          buildAutoCancelStudentContent(appointment.startTime),
        );
      }

      if (coachId) {
        await this.notifications.sendSystemNotification(
          coachId,
          AUTO_CANCEL_TITLE,
          buildAutoCancelCoachContent(appointment.student?.name ?? null, appointment.startTime),
        );
      }
    } catch (error) {
      const err = error as Error;
      const message = err?.message ?? String(error);
      this.logger.warn(`Auto-cancel notification failed: ${message}`);
    }
  }
}
