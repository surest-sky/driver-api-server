import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum MessageType { text = 'text', image = 'image', file = 'file', system = 'system' }

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'bigint', name: 'conversation_id' })
  conversationId!: number;

  @Index()
  @Column({ type: 'bigint', name: 'sender_id' })
  senderId!: number;

  @Index()
  @Column({ type: 'bigint', name: 'receiver_id' })
  receiverId!: number;

  @Column({ type: 'varchar', length: 191, name: 'sender_name' })
  senderName!: string;

  @Column({ type: 'varchar', length: 191, name: 'receiver_name' })
  receiverName!: string;

  @Column({ type: 'enum', enum: MessageType, name: 'message_type', default: MessageType.text })
  type!: MessageType;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'datetime', name: 'read_at', nullable: true })
  readAt!: Date | null;
}
