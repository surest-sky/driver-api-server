import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppointmentRepeat = 'weekly';

@Entity('appointment_recurrences')
export class AppointmentRecurrence {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'bigint', name: 'student_id' })
  studentId!: number;

  @Index()
  @Column({ type: 'bigint', name: 'coach_id' })
  coachId!: number;

  @Column({ type: 'datetime', name: 'start_time' })
  startTime!: Date;

  @Column({ type: 'datetime', name: 'end_time' })
  endTime!: Date;

  @Column({ type: 'enum', enum: ['weekly'], default: 'weekly' })
  repeat!: AppointmentRepeat;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'datetime', name: 'last_generated_at', nullable: true })
  lastGeneratedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
