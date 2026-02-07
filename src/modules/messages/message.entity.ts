import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum MessageType {
  text = 'text',
  image = 'image',
  file = 'file',
  system = 'system',
  course = 'course',
}

/**
 * 发送者角色枚举
 * - coach: 教练发送
 * - student: 学员发送
 */
export enum MessageSender {
  coach = 'coach',
  student = 'student',
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'bigint', name: 'coach_id' })
  coachId!: number;

  @Index()
  @Column({ type: 'bigint', name: 'student_id' })
  studentId!: number;

  @Index()
  @Column({
    type: 'enum',
    enum: MessageSender,
    name: 'sender',
    default: MessageSender.student,
  })
  sender!: MessageSender;

  @Column({ type: 'enum', enum: MessageType, name: 'message_type', default: MessageType.text })
  type!: MessageType;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'datetime', name: 'read_at', nullable: true })
  readAt!: Date | null;
}
