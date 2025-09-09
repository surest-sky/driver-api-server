import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

export enum RelationStatus {
  active = 'active',
  inactive = 'inactive',
}

@Entity('student_coach_relations')
@Index(['studentId', 'coachId'], { unique: true })
export class StudentCoachRelation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId!: number;

  @Column({ type: 'bigint', name: 'coach_id' })
  coachId!: number;

  @ManyToOne(() => User, user => user.coachRelations)
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @ManyToOne(() => User, user => user.studentRelations)
  @JoinColumn({ name: 'coach_id' })
  coach!: User;

  @Column({ type: 'datetime', name: 'assigned_at', default: () => 'CURRENT_TIMESTAMP' })
  assignedAt!: Date;

  @Column({ type: 'enum', enum: RelationStatus, default: RelationStatus.active })
  status!: RelationStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}