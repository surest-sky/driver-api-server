import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, MessageType, MessageSender } from './message.entity';

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
    appointmentId: number | string;
    coachName: string;
    studentName: string;
    type: AppointmentMessageType;
    startTime: Date;
    endTime: Date;
    reason?: string; // Rejection reason (optional)
    initiator?: 'coach' | 'student'; // Initiator
  }) {
    console.log('[ChatService] sendAppointmentMessage called:', params);
    const content = String(params.appointmentId);
    console.log('[ChatService] Appointment message payload:', {
      appointmentId: content,
      messageType: MessageType.course,
      appointmentEventType: params.type,
    });

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
      type: MessageType.course,
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
}
