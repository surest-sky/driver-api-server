import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum MessageType { text = 'text', image = 'image', video = 'video', file = 'file' }
export enum MessageStatus { sending = 'sending', sent = 'sent', delivered = 'delivered', read = 'read', failed = 'failed' }

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  conversationId!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  senderId!: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  receiverId!: string;

  @Column({ type: 'varchar', length: 191 })
  senderName!: string;

  @Column({ type: 'varchar', length: 191 })
  receiverName!: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.text })
  type!: MessageType;

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.sent })
  status!: MessageStatus;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  readAt!: Date | null;
}

