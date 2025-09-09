import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  studentId!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  coachId!: string;

  @Column({ type: 'varchar', length: 191 })
  studentName!: string;

  @Column({ type: 'varchar', length: 191 })
  coachName!: string;

  @Column({ type: 'datetime', nullable: true })
  lastMessageAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

