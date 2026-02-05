import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AccountDeletion, AccountDeletionStatus } from './account-deletion.entity';
import { User } from '../users/user.entity';

const DAYS_TO_DELETE = 30;

@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    @InjectRepository(AccountDeletion)
    private readonly deletionRepo: Repository<AccountDeletion>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async requestDeletion(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const existing = await this.deletionRepo.findOne({
      where: { userId },
    });
    if (existing?.status === AccountDeletionStatus.pending) {
      throw new ConflictException('Deletion request already in progress');
    }

    const requestedAt = new Date();
    const scheduledAt = new Date(requestedAt.getTime());
    scheduledAt.setDate(scheduledAt.getDate() + DAYS_TO_DELETE);

    if (!existing) {
      const record = this.deletionRepo.create({
        userId,
        status: AccountDeletionStatus.pending,
        requestedAt,
        scheduledAt,
        restoredAt: null,
        completedAt: null,
      });
      await this.deletionRepo.save(record);
    } else {
      existing.status = AccountDeletionStatus.pending;
      existing.requestedAt = requestedAt;
      existing.scheduledAt = scheduledAt;
      existing.restoredAt = null;
      existing.completedAt = null;
      await this.deletionRepo.save(existing);
    }

    return { scheduledAt };
  }

  async getStatus(userId: number) {
    const record = await this.deletionRepo.findOne({ where: { userId } });
    if (!record) {
      return { status: null, requestedAt: null, scheduledAt: null };
    }
    return {
      status: record.status,
      requestedAt: record.requestedAt,
      scheduledAt: record.scheduledAt,
      restoredAt: record.restoredAt,
      completedAt: record.completedAt,
    };
  }

  async getPending(userId: number) {
    return this.deletionRepo.findOne({
      where: { userId, status: AccountDeletionStatus.pending },
    });
  }

  async restore(userId: number) {
    const record = await this.deletionRepo.findOne({ where: { userId } });
    if (!record || record.status !== AccountDeletionStatus.pending) {
      throw new BadRequestException('No pending deletion request');
    }

    record.status = AccountDeletionStatus.restored;
    record.restoredAt = new Date();
    await this.deletionRepo.save(record);

    return { restored: true };
  }

  @Cron('0 3 * * *')
  async handleScheduledDeletion() {
    const now = new Date();
    const targets = await this.deletionRepo.find({
      where: {
        status: AccountDeletionStatus.pending,
        scheduledAt: LessThanOrEqual(now),
      },
    });

    if (targets.length === 0) return;

    for (const record of targets) {
      try {
        await this.processDeletion(record, now);
      } catch (error) {
        this.logger.error(
          `Failed to process deletion for user ${record.userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async processDeletion(record: AccountDeletion, now: Date) {
    const user = await this.userRepo.findOne({
      where: { id: record.userId, deletedAt: IsNull() },
    });
    if (!user) {
      record.status = AccountDeletionStatus.completed;
      record.completedAt = now;
      await this.deletionRepo.save(record);
      return;
    }

    const randomPassword = randomUUID();
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const anonymizedEmail = `deleted+${user.id}@example.com`;

    await this.userRepo.update(
      { id: user.id },
      {
        name: 'Deleted User',
        email: anonymizedEmail,
        phone: null,
        avatarUrl: null,
        birthDate: null,
        location: null,
        passwordHash,
        pendingSchoolCode: null,
        deletedAt: now,
      },
    );

    record.status = AccountDeletionStatus.completed;
    record.completedAt = now;
    await this.deletionRepo.save(record);
  }
}
