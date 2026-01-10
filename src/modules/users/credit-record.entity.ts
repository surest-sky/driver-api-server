import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

const creditTransformer = {
  to: (value?: number | null) => value ?? 0,
  from: (value?: string | number | null) =>
    value == null ? 0 : Number(value),
};

@Entity('credit_records')
@Index(['studentId', 'createdAt'])
@Index(['coachId', 'createdAt'])
export class CreditRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'student_id' })
  studentId!: number;

  @Column({ name: 'coach_id' })
  coachId!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: creditTransformer,
  })
  delta!: number;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({
    name: 'balance_after',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: creditTransformer,
  })
  balanceAfter!: number;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coach_id' })
  coach!: User;
}
