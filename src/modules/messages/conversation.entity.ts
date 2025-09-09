import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'bigint', name: 'participant1_id' })
  participant1Id!: number;

  @Column({ type: 'varchar', length: 191, name: 'participant1_name' })
  participant1Name!: string;

  @Index()
  @Column({ type: 'bigint', name: 'participant2_id' })
  participant2Id!: number;

  @Column({ type: 'varchar', length: 191, name: 'participant2_name' })
  participant2Name!: string;

  @Column({ type: 'datetime', name: 'last_message_at', nullable: true })
  lastMessageAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
