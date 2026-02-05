import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AccountDeletionStatus {
  pending = 'pending',
  restored = 'restored',
  completed = 'completed',
}

@Entity('account_deletions')
export class AccountDeletion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'bigint', name: 'user_id' })
  userId!: number;

  @Column({
    type: 'enum',
    enum: AccountDeletionStatus,
    default: AccountDeletionStatus.pending,
  })
  status!: AccountDeletionStatus;

  @Column({ type: 'datetime', name: 'requested_at' })
  requestedAt!: Date;

  @Column({ type: 'datetime', name: 'scheduled_at' })
  scheduledAt!: Date;

  @Column({ type: 'datetime', name: 'restored_at', nullable: true })
  restoredAt!: Date | null;

  @Column({ type: 'datetime', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
