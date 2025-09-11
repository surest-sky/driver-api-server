import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AvailabilityRepeat = 'always' | 'once';

@Entity('availability')
export class Availability {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ type: 'datetime', name: 'start_time' })
  startTime!: Date;

  @Column({ type: 'datetime', name: 'end_time' })
  endTime!: Date;

  @Column({ type: 'enum', enum: ['always', 'once'], default: 'always' })
  repeat!: AvailabilityRepeat;

  @Column({ type: 'boolean', default: true, name: 'is_unavailable' })
  isUnavailable!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
