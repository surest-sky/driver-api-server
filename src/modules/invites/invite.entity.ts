import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum InviteStatus { pending = 'pending', success = 'success', failed = 'failed' }

@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  coachId!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  studentId!: string;

  @Column({ type: 'enum', enum: InviteStatus, default: InviteStatus.pending })
  status!: InviteStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

