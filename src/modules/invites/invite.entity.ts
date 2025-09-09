import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum InviteStatus { pending = 'pending', accepted = 'accepted', expired = 'expired' }
export type InviteRole = 'student' | 'coach';

@Entity('invites')
export class Invite {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 64, unique: true })
  code!: string;

  @Index({ where: undefined })
  @Column({ type: 'bigint', name: 'inviter_id', nullable: true })
  inviterId!: number | null;

  @Column({ type: 'varchar', length: 191, name: 'invitee_email' })
  inviteeEmail!: string;

  @Index()
  @Column({ type: 'bigint', name: 'school_id' })
  schoolId!: number;

  @Column({ type: 'enum', enum: ['student', 'coach'], default: 'student' })
  role!: InviteRole;

  @Index()
  @Column({ type: 'enum', enum: InviteStatus, default: InviteStatus.pending })
  status!: InviteStatus;

  @Index()
  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt!: Date;

  @Index()
  @Column({ type: 'datetime', name: 'used_at', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
