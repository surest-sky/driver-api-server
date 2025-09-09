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
    const userId = req.user.sub as string;
    const { items, total } = await this.svc.listConversations(userId, Number(page) || 1, Number(pageSize) || 20, q);
    // 扩展 lastMessage 与未读数（针对当前用户）
    const result = [] as any[];
    for (const c of items) {
      const last = await this.msgRepo.findOne({ where: { conversationId: c.id }, order: { createdAt: 'DESC' } });
      const unread = await this.msgRepo.count({ where: [
        { conversationId: c.id, receiverId: userId, status: 'sent' as any },
        { conversationId: c.id, receiverId: userId, status: 'delivered' as any },
      ] });
      result.push({ ...c, lastMessage: last, unreadCount: unread });
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
    await this.svc.markReadByUser(id, req.user.sub);
    return { ok: true };
  }

  @Post('send')
  async send(@Req() req: any, @Body() body: any) {
    // body: { conversationId, receiverId, receiverName, content, type }
    return this.svc.sendMessage({
      conversationId: body.conversationId,
      senderId: req.user.sub,
      senderName: body.senderName,
      receiverId: body.receiverId,
      receiverName: body.receiverName,
      content: body.content,
      type: body.type,
    });
  }

  @Post('get-or-create')
  async getOrCreate(@Body() body: { studentId: string; coachId: string }) {
    const student = await this.users.findById(body.studentId);
    const coach = await this.users.findById(body.coachId);
    if (!student || !coach) throw new Error('user not found');
    const conv = await this.svc.getOrCreateConversation(student.id, student.name, coach.id, coach.name);
    return conv;
  }
}
