import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message, MessageStatus, MessageType } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
  ) {}

  getOrCreateConversation(studentId: string, studentName: string, coachId: string, coachName: string) {
    return this.convRepo.findOne({ where: { studentId, coachId } }).then(async (found) => {
      if (found) return found;
      const conv = this.convRepo.create({ studentId, studentName, coachId, coachName });
      return this.convRepo.save(conv);
    });
  }

  async listConversations(userId: string, page: number, pageSize: number, q?: string) {
    const qb = this.convRepo.createQueryBuilder('c')
      .where('c.studentId = :id OR c.coachId = :id', { id: userId })
      .orderBy('c.updatedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (q && q.trim()) {
      qb.andWhere('(c.studentName LIKE :q OR c.coachName LIKE :q)', { q: `%${q.trim()}%` });
    }
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listMessages(conversationId: string, page: number, pageSize: number) {
    const [items, total] = await this.msgRepo.findAndCount({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total };
  }

  async sendMessage(params: {
    conversationId: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    content: string;
    type?: MessageType;
  }) {
    const msg = this.msgRepo.create({
      ...params,
      type: params.type || MessageType.text,
      status: MessageStatus.sent,
    });
    const saved = await this.msgRepo.save(msg);
    await this.convRepo.update(
      { id: params.conversationId },
      { lastMessageAt: saved.createdAt },
    );
    return saved;
  }

  async markReadByUser(conversationId: string, userId: string) {
    await this.msgRepo.update({ conversationId, receiverId: userId, status: MessageStatus.sent }, { status: MessageStatus.read, readAt: new Date() });
    await this.msgRepo.update({ conversationId, receiverId: userId, status: MessageStatus.delivered }, { status: MessageStatus.read, readAt: new Date() });
  }
}
