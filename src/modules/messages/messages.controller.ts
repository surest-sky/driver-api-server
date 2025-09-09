import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MessagesService } from './messages.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { Conversation } from './conversation.entity';
import { UsersService } from '../users/users.service';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly svc: MessagesService,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    private readonly users: UsersService,
  ) {}

  @Get('conversations')
  async conversations(@Req() req: any, @Query('page') page = '1', @Query('pageSize') pageSize = '20', @Query('q') q?: string) {
    const userId = Number(req.user.sub);
    const { items, total } = await this.svc.listConversations(userId, Number(page) || 1, Number(pageSize) || 20, q);
    // 扩展 lastMessage 与未读数（针对当前用户）
    const result = [] as any[];
    for (const c of items) {
      const last = await this.msgRepo.findOne({ where: { conversationId: c.id }, order: { createdAt: 'DESC' } });
      const unread = await this.msgRepo.count({ where: { conversationId: c.id, receiverId: userId, readAt: null as any } });
      // 为前端兼容保留 student/coach 语义字段（基于当前用户识别对端）
      const isP1 = c.participant1Id === userId;
      const role = (req.user && req.user.role) || undefined;
      const asStudent = role === 'student';
      result.push({
        id: c.id,
        participant1Id: c.participant1Id,
        participant1Name: c.participant1Name,
        participant2Id: c.participant2Id,
        participant2Name: c.participant2Name,
        lastMessageAt: c.lastMessageAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        peerId: isP1 ? c.participant2Id : c.participant1Id,
        peerName: isP1 ? c.participant2Name : c.participant1Name,
        // 兼容旧字段命名
        studentId: asStudent ? userId : (isP1 ? c.participant2Id : c.participant1Id),
        studentName: asStudent ? (isP1 ? c.participant1Name : c.participant2Name) : (isP1 ? c.participant2Name : c.participant1Name),
        coachId: asStudent ? (isP1 ? c.participant2Id : c.participant1Id) : userId,
        coachName: asStudent ? (isP1 ? c.participant2Name : c.participant1Name) : (isP1 ? c.participant1Name : c.participant2Name),
        lastMessage: last,
        unreadCount: unread,
      });
    }
    return { items: result, total };
  }

  @Get('conversations/:id/messages')
  async list(@Param('id') id: string, @Query('page') page = '1', @Query('pageSize') pageSize = '100') {
    const { items, total } = await this.svc.listMessages(id, Number(page) || 1, Number(pageSize) || 100);
    return { items, total };
  }

  @Post('conversations/:id/read')
  async markRead(@Req() req: any, @Param('id') id: string) {
    await this.svc.markReadByUser(id, String(req.user.sub));
    return { ok: true };
  }

  @Post('send')
  async send(@Req() req: any, @Body() body: any) {
    // body: { conversationId, receiverId, receiverName, content, type }
    return this.svc.sendMessage({
      conversationId: body.conversationId,
      senderId: Number(req.user.sub),
      senderName: body.senderName,
      receiverId: body.receiverId,
      receiverName: body.receiverName,
      content: body.content,
      type: body.type,
    });
  }

  @Post('get-or-create')
  async getOrCreate(@Body() body: { studentId: string; coachId: string }) {
    const student = await this.users.findById(+body.studentId);
    const coach = await this.users.findById(+body.coachId);
    if (!student || !coach) throw new Error('user not found');
    const conv = await this.svc.getOrCreateConversation(student.id, student.name, coach.id, coach.name);
    return conv;
  }
}
