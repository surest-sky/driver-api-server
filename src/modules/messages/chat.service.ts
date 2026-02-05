import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageType, MessageSender } from './message.entity';
import dayjs from 'dayjs';

/**
 * Message type enum
 */
export enum AppointmentMessageType {
  created = 'created',
  confirmed = 'confirmed',
  rejected = 'rejected',
  cancelled = 'cancelled',
  rescheduled = 'rescheduled',
  completed = 'completed',
}

/**
 * Chat Service - Unified message sending management
 *
 * New architecture: Direct use of coach_id and student_id, no conversations table needed
 *
 * Features:
 * 1. Unified message formatting logic (solves timezone issues)
 * 2. Unified message sending interface
 * 3. Support for appointment-related messages
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Message)
    private readonly msgRepo: Repository<Message>,
  ) {}

  /**
   * Send appointment-related message
   *
   * @param params Message parameters
   * @returns Sent message
   */
  async sendAppointmentMessage(params: {
    coachId: number | string;
    studentId: number | string;
    coachName: string;
    studentName: string;
    type: AppointmentMessageType;
    startTime: Date;
    endTime: Date;
    reason?: string; // Rejection reason (optional)
    initiator?: 'coach' | 'student'; // Initiator
  }) {
    console.log('[ChatService] sendAppointmentMessage called:', params);
    const content = this._formatAppointmentMessage(
      params.type,
      params.startTime,
      params.endTime,
      params.studentName,
      params.coachName,
      params.reason,
    );

    console.log('[ChatService] Formatted content:', content);

    // Set sender based on initiator
    const sender = params.initiator === 'student' ? MessageSender.student : MessageSender.coach;
    const senderId = sender === MessageSender.student ? params.studentId : params.coachId;
    const senderName = sender === MessageSender.student ? params.studentName : params.coachName;

    console.log('[ChatService] Sending message:', { coachId: params.coachId, studentId: params.studentId, senderId, senderName, sender });

    return this.sendMessage({
      coachId: params.coachId,
      studentId: params.studentId,
      senderId: senderId,
      senderName: senderName,
      content,
      type: MessageType.system,
    });
  }

  /**
   * Send regular text message
   *
   * @param params Message parameters
   * @returns Sent message
   */
  async sendMessage(params: {
    coachId: number | string;
    studentId: number | string;
    senderId: number | string;
    senderName: string;
    content: string;
    type?: MessageType;
  }) {
    console.log('[ChatService] sendMessage called:', params);
    const coachId = Number(params.coachId);
    const studentId = Number(params.studentId);
    const senderId = Number(params.senderId);

    if (!Number.isFinite(coachId) || !Number.isFinite(studentId) || !Number.isFinite(senderId)) {
      throw new Error('Invalid user ID');
    }

    // Determine sender role based on senderId
    const sender = senderId === coachId ? MessageSender.coach : MessageSender.student;

    console.log('[ChatService] Creating message:', { coachId, studentId, sender, content: params.content, type: params.type });

    const msg = this.msgRepo.create({
      coachId,
      studentId,
      sender,
      content: params.content,
      type: params.type || MessageType.text,
    });

    const saved = await this.msgRepo.save(msg);
    console.log('[ChatService] Message saved:', saved);
    return saved;
  }

  /**
   * 格式化预约消息
   *
   * @param type 消息类型
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param studentName 学生姓名
   * @param coachName 教练姓名
   * @param reason 拒绝原因
   * @returns 格式化后的消息
   */
  private _formatAppointmentMessage(
    type: AppointmentMessageType,
    startTime: Date,
    endTime: Date,
    studentName?: string,
    coachName?: string,
    reason?: string,
  ): string {
    const timeStr = this._formatAppointmentTime(startTime, endTime);

    switch (type) {
      case AppointmentMessageType.created:
        return `📅 Your coach has scheduled a lesson for you: ${timeStr}`;
      case AppointmentMessageType.confirmed:
        return `✅ Lesson confirmed: ${timeStr}`;
      case AppointmentMessageType.rejected:
        return `❌ Lesson request declined${reason ? `: ${reason}` : ''}`;
      case AppointmentMessageType.cancelled:
        return `🚫 Lesson cancelled: ${timeStr}`;
      case AppointmentMessageType.rescheduled:
        return `📅 Lesson rescheduled to: ${timeStr}`;
      case AppointmentMessageType.completed:
        return `🎉 Lesson completed!`;
      default:
        return `📅 Lesson update: ${timeStr}`;
    }
  }

  /**
   * 格式化预约时间为欧美友好的格式
   *
   * 例如：Sep 10, 2025 at 6:00 AM - 7:00 AM
   *
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 格式化后的时间字符串
   */
  private _formatAppointmentTime(startTime: Date, endTime: Date): string {
    const start = dayjs(startTime);
    const end = dayjs(endTime);

    // 如果是同一天，格式为：Sep 10, 2025 at 6:00 AM - 7:00 AM
    // 如果是不同天，格式为：Sep 10, 6:00 AM - Sep 11, 7:00 AM
    if (start.format('YYYY-MM-DD') === end.format('YYYY-MM-DD')) {
      return `${start.format('MMM D, YYYY')} at ${start.format('h:mm A')} - ${end.format('h:mm A')}`;
    } else {
      return `${start.format('MMM D, h:mm A')} - ${end.format('MMM D, h:mm A')}`;
    }
  }
}
