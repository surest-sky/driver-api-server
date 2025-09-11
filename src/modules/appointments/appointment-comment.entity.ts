import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('appointment_comments')
export class AppointmentCommentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'bigint', name: 'appointment_id' })
  appointmentId!: number;

  @Index()
  @Column({ type: 'bigint', name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 191, name: 'user_name' })
  userName!: string;

  @Column({ type: 'varchar', length: 32 })
  role!: 'student' | 'coach';

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

