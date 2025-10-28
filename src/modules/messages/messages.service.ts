import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Conversation } from "./conversation.entity";
import { Message, MessageType } from "./message.entity";

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
  ) {}

  getOrCreateConversation(
    participant1Id: number | string,
    participant1Name: string,
    participant2Id: number | string,
    participant2Name: string,
  ) {
    const p1 = Number(participant1Id);
    const p2 = Number(participant2Id);
    return this.convRepo
      .findOne({ where: { participant1Id: p1, participant2Id: p2 } })
      .then(async (found) => {
        if (found) return found;
        const conv = this.convRepo.create({
          participant1Id: p1,
          participant1Name,
          participant2Id: p2,
          participant2Name,
        });
        return this.convRepo.save(conv);
      });
  }

  async listConversations(
    userId: string | number,
    page: number,
    pageSize: number,
    q?: string,
  ) {
    const qb = this.convRepo
      .createQueryBuilder("c")
      .where("c.participant1Id = :id OR c.participant2Id = :id", {
        id: Number(userId),
      })
      .orderBy("c.updatedAt", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (q && q.trim()) {
      qb.andWhere(
        "(c.participant1Name LIKE :q OR c.participant2Name LIKE :q)",
        { q: `%${q.trim()}%` },
      );
    }
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async listMessages(
    conversationId: string,
    page: number,
    pageSize: number,
    sortField?: string,
    sortDirection?: string,
  ) {
    const normalizedField = (sortField || "created_at").toLowerCase();
    const fieldMap: Record<string, keyof Message> = {
      created_at: "createdAt",
      id: "id",
    };
    const orderField = fieldMap[normalizedField] || "createdAt";
    const normalizedDirection = (sortDirection || "asc").toUpperCase();
    const direction = normalizedDirection === "DESC" ? "DESC" : "ASC";
    const order: any = { [orderField]: direction };

    const [items, total] = await this.msgRepo.findAndCount({
      where: { conversationId: Number(conversationId) },
      order,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total };
  }

  async sendMessage(params: {
    conversationId: string | number;
    senderId: string | number;
    senderName?: string;
    receiverId?: string | number;
    receiverName?: string;
    content: string;
    type?: MessageType;
  }) {
    const conversationId = Number(params.conversationId);
    if (!Number.isFinite(conversationId)) {
      throw new BadRequestException("无效的会话 ID");
    }

    const conversation = await this.convRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException("会话不存在");
    }

    const senderId = Number(params.senderId);
    if (!Number.isFinite(senderId)) {
      throw new BadRequestException("无效的发送者 ID");
    }

    const participant1Id = Number(conversation.participant1Id);
    const participant2Id = Number(conversation.participant2Id);

    const senderIsP1 = senderId === participant1Id;
    const senderIsP2 = senderId === participant2Id;
    if (!senderIsP1 && !senderIsP2) {
      throw new BadRequestException("发送者不属于该会话");
    }

    const expectedReceiverId = senderIsP1 ? participant2Id : participant1Id;
    if (!Number.isFinite(expectedReceiverId) || expectedReceiverId <= 0) {
      throw new BadRequestException("会话的接收者信息无效");
    }

    let receiverId: number;
    const rawReceiverId = params.receiverId;
    if (
      rawReceiverId === undefined ||
      rawReceiverId === null ||
      String(rawReceiverId).trim() === ""
    ) {
      receiverId = expectedReceiverId;
    } else {
      receiverId = Number(rawReceiverId);
      if (!Number.isFinite(receiverId)) {
        throw new BadRequestException("无效的接收者 ID");
      }
      if (receiverId !== expectedReceiverId) {
        throw new BadRequestException("接收者不属于该会话");
      }
    }

    const resolvedSenderName =
      params.senderName && params.senderName.trim().length > 0
        ? params.senderName
        : senderIsP1
          ? conversation.participant1Name
          : conversation.participant2Name;

    const resolvedReceiverName =
      params.receiverName && params.receiverName.trim().length > 0
        ? params.receiverName
        : receiverId === participant1Id
          ? conversation.participant1Name
          : conversation.participant2Name;

    const msg = this.msgRepo.create({
      conversationId,
      senderId,
      senderName: resolvedSenderName,
      receiverId,
      receiverName: resolvedReceiverName,
      content: params.content,
      type: params.type || MessageType.text,
    });
    const saved = await this.msgRepo.save(msg);
    await this.convRepo.update(
      { id: conversationId },
      { lastMessageAt: saved.createdAt },
    );
    return saved;
  }

  async markReadByUser(conversationId: string, userId: string) {
    await this.msgRepo
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: () => "CURRENT_TIMESTAMP" })
      .where(
        "conversation_id = :cid AND receiver_id = :uid AND read_at IS NULL",
        { cid: Number(conversationId), uid: Number(userId) },
      )
      .execute();
  }
}
