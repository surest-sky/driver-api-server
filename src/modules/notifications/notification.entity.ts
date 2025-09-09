import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Index } from 'typeorm';

export enum NotificationType {
  appointment = 'appointment',
  message = 'message',
  invite = 'invite',
  system = 'system',
  reminder = 'reminder',
}

export enum NotificationStatus {
  unread = 'unread',
  read = 'read',
  deleted = 'deleted',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'json', nullable: true })
  data?: any; // 额外的数据，如预约ID、消息ID等

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.unread })
  status!: NotificationStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actionUrl?: string | null; // 点击通知后的跳转URL

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}