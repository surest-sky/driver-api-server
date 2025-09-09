import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum AppointmentStatus { 
  pending = 'pending', 
  confirmed = 'confirmed', 
  rejected = 'rejected', 
  cancelled = 'cancelled', 
  completed = 'completed',
  no_show = 'no_show'
}

export enum AppointmentType { 
  regular = 'regular', 
  trial = 'trial',
  exam = 'exam',
  makeup = 'makeup'
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'bigint', name: 'student_id' })
  studentId!: number;

  @Index()
  @Column({ type: 'bigint', name: 'coach_id' })
  coachId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coach_id' })
  coach!: User;

  @Index()
  @Column({ type: 'datetime', name: 'start_time' })
  startTime!: Date;

  @Index()
  @Column({ type: 'datetime', name: 'end_time' })
  endTime!: Date;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.pending })
  status!: AppointmentStatus;

  @Column({ type: 'enum', enum: AppointmentType, default: AppointmentType.regular })
  type!: AppointmentType;

  @Column({ type: 'varchar', length: 191, nullable: true })
  location!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'text', nullable: true, name: 'coach_notes' })
  coachNotes!: string | null;

  @Column({ type: 'text', nullable: true, name: 'student_notes' })
  studentNotes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

