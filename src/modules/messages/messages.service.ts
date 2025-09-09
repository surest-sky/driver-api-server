import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message, MessageType } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
  ) {}

  getOrCreateConversation(participant1Id: number | string, participant1Name: string, participant2Id: number | string, participant2Name: string) {
    const p1 = Number(participant1Id);
    const p2 = Number(participant2Id);
    return this.convRepo.findOne({ where: { participant1Id: p1, participant2Id: p2 } }).then(async (found) => {
      if (found) return found;
      const conv = this.convRepo.create({ participant1Id: p1, participant1Name, participant2Id: p2, participant2Name });
      return this.convRepo.save(conv);
    });
  }

  async listConversations(userId: string | number, page: number, pageSize: number, q?: string) {
    const qb = this.convRepo.createQueryBuilder('c')
      .where('c.participant1Id = :id OR c.participant2Id = :id', { id: Number(userId) })
      .orderBy('c.updatedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (q && q.trim()) {
      qb.andWhere('(c.participant1Name LIKE :q OR c.participant2Name LIKE :q)', { q: `%${q.trim()}%` });
    }
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listMessages(conversationId: string, page: number, pageSize: number) {
    const [items, total] = await this.msgRepo.findAndCount({
      where: { conversationId: Number(conversationId) },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total };
  }

  async sendMessage(params: {
    conversationId: string | number;
    senderId: string | number;
    senderName: string;
    receiverId: string | number;
    receiverName: string;
    content: string;
    type?: MessageType;
  }) {
    const msg = this.msgRepo.create({
      conversationId: Number(params.conversationId),
      senderId: Number(params.senderId),
      senderName: params.senderName,
      receiverId: Number(params.receiverId),
      receiverName: params.receiverName,
      content: params.content,
      type: params.type || MessageType.text,
    });
    const saved = await this.msgRepo.save(msg);
    await this.convRepo.update(
      { id: Number(params.conversationId) },
      { lastMessageAt: saved.createdAt },
    );
    return saved;
  }

  async markReadByUser(conversationId: string, userId: string) {
    await this.msgRepo.createQueryBuilder()
      .update(Message)
      .set({ readAt: () => 'CURRENT_TIMESTAMP' })
      .where('conversation_id = :cid AND receiver_id = :uid AND read_at IS NULL', { cid: Number(conversationId), uid: Number(userId) })
      .execute();
  }
}
