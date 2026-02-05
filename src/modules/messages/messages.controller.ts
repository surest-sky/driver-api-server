import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ChatService, AppointmentMessageType } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Message, MessageType, MessageSender } from './message.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

/**
 * 消息控制器
 *
 * 新架构：直接使用 coach_id 和 student_id，不需要 conversations 表
 */
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly chat: ChatService,
    private readonly chatGateway: ChatGateway,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly users: UsersService,
  ) {}

  /**
   * 教练端专用：获取学员消息列表
   *
   * GET /messages/coach/students
   *
   * 返回：教练的所有学员 + 最后一条消息 + 未读数
   */
  @Get('coach/students')
  async getCoachStudentsWithMessages(@Req() req: any) {
    const coachId = Number(req.user.sub);

    // 1. 获取当前教练的 school_id
    const coach = await this.userRepo.findOne({
      where: { id: coachId, deletedAt: IsNull() },
    });
    if (!coach || !coach.schoolId) {
      return { items: [], total: 0 };
    }

    // 2. 查询该 school_id 下的所有学生用户
    const students = await this.userRepo
      .createQueryBuilder('u')
      .where('u.school_id = :schoolId', { schoolId: coach.schoolId })
      .andWhere('u.role = :role', { role: 'student' })
      .andWhere('u.deleted_at IS NULL')
      .orderBy('u.createdAt', 'DESC')
      .getMany();

    // 3. 如果没有学员，返回空数组
    if (!students || students.length === 0) {
      return { items: [], total: 0 };
    }

    const studentIds = students.map((s) => Number(s.id));

    // 4. 批量查询最后一条消息
    const lastMessages = await this.msgRepo
      .createQueryBuilder('m')
      .where('m.coach_id = :coachId', { coachId })
      .andWhere('m.student_id IN (:...studentIds)', { studentIds })
      .orderBy('m.created_at', 'DESC')
      .getMany();

    console.log(`[DEBUG] coachId: ${coachId}, studentIds: ${studentIds}`);
    console.log(`[DEBUG] lastMessages count: ${lastMessages.length}`);
    console.log(`[DEBUG] lastMessages:`, JSON.stringify(lastMessages, null, 2));

    // 按学生 ID 分组最后一条消息
    // 注意：TypeORM 返回的 studentId 是字符串（bigint 类型）
    const messageMap = new Map<string, Message>();
    for (const msg of lastMessages) {
      const sid = String(msg.studentId);
      if (!messageMap.has(sid)) {
        messageMap.set(sid, msg);
      }
    }

    console.log(`[DEBUG] messageMap:`, Array.from(messageMap.entries()));

    // 4. 批量查询未读数
    // 修改：使用 sender 判断而非 receiver_id
    // 教练端的未读消息 = sender 是 'student' 且未读的消息
    const unreadCounts = await this.msgRepo
      .createQueryBuilder('m')
      .select('m.student_id', 'studentId')
      .addSelect('COUNT(*)', 'count')
      .where('m.coach_id = :coachId', { coachId })
      .andWhere('m.student_id IN (:...studentIds)', { studentIds })
      .andWhere('m.sender = :sender', { sender: MessageSender.student })
      .andWhere('m.read_at IS NULL')
      .groupBy('m.student_id')
      .getRawMany();

    const unreadMap = new Map<number, number>();
    for (const row of unreadCounts) {
      unreadMap.set(Number(row.studentId), Number(row.count));
    }

    // 5. 组装返回数据
    const avatarOrEmpty = (url?: string | null) => (url ? String(url) : '');
    const result = students.map((s) => {
      const studentId = Number(s.id);
      const studentIdStr = String(studentId);  // 字符串用于查找 messageMap
      const lastMessage = messageMap.get(studentIdStr);
      const unreadCount = unreadMap.get(studentId) || 0;

      return {
        id: studentId,
        displayName: s.name,
        email: s.email,
        avatarUrl: avatarOrEmpty(s.avatarUrl),
        createdAt: s.createdAt,
        // 兼容前端字段名
        name: s.name,
        studentId: String(studentId),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount: unreadCount,
      };
    });

    // 按最后消息时间排序，无消息靠后
    result.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : null;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : null;

      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return bTime - aTime;
    });

    return { items: result, total: result.length };
  }

  /**
   * 学员端专用：获取教练消息列表
   *
   * GET /messages/student/coaches
   *
   * 返回：同校教练 + 最后一条消息 + 未读数
   */
  @Get('student/coaches')
  async getStudentCoachesWithMessages(@Req() req: any) {
    const studentId = Number(req.user.sub);

    // 1. 获取当前学员的 school_id
    const student = await this.userRepo.findOne({
      where: { id: studentId, deletedAt: IsNull() },
    });
    if (!student || !student.schoolId) {
      return { items: [], total: 0 };
    }

    // 2. 查询该 school_id 下的所有教练用户
    const coaches = await this.userRepo
      .createQueryBuilder('u')
      .where('u.school_id = :schoolId', { schoolId: student.schoolId })
      .andWhere('u.role = :role', { role: 'coach' })
      .andWhere('u.deleted_at IS NULL')
      .orderBy('u.createdAt', 'DESC')
      .getMany();

    if (!coaches || coaches.length === 0) {
      return { items: [], total: 0 };
    }

    const coachIds = coaches.map((c) => Number(c.id));

    // 3. 批量查询最后一条消息
    const lastMessages = await this.msgRepo
      .createQueryBuilder('m')
      .where('m.student_id = :studentId', { studentId })
      .andWhere('m.coach_id IN (:...coachIds)', { coachIds })
      .orderBy('m.created_at', 'DESC')
      .getMany();

    // 按教练 ID 分组最后一条消息
    const messageMap = new Map<string, Message>();
    for (const msg of lastMessages) {
      const cid = String(msg.coachId);
      if (!messageMap.has(cid)) {
        messageMap.set(cid, msg);
      }
    }

    // 4. 批量查询未读数（学员端：教练发送且未读）
    const unreadCounts = await this.msgRepo
      .createQueryBuilder('m')
      .select('m.coach_id', 'coachId')
      .addSelect('COUNT(*)', 'count')
      .where('m.student_id = :studentId', { studentId })
      .andWhere('m.coach_id IN (:...coachIds)', { coachIds })
      .andWhere('m.sender = :sender', { sender: MessageSender.coach })
      .andWhere('m.read_at IS NULL')
      .groupBy('m.coach_id')
      .getRawMany();

    const unreadMap = new Map<number, number>();
    for (const row of unreadCounts) {
      unreadMap.set(Number(row.coachId), Number(row.count));
    }

    // 5. 组装返回数据
    const avatarOrEmpty = (url?: string | null) => (url ? String(url) : '');
    const result = coaches.map((c) => {
      const coachId = Number(c.id);
      const coachIdStr = String(coachId);
      const lastMessage = messageMap.get(coachIdStr);
      const unreadCount = unreadMap.get(coachId) || 0;

      return {
        id: coachId,
        displayName: c.name,
        email: c.email,
        avatarUrl: avatarOrEmpty(c.avatarUrl),
        createdAt: c.createdAt,
        name: c.name,
        coachId: String(coachId),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount: unreadCount,
      };
    });

    // 按最后消息时间排序，无消息靠后
    result.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : null;
      const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : null;

      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;
      return bTime - aTime;
    });

    return { items: result, total: result.length };
  }

  /**
   * 获取与某个学员的聊天记录
   *
   * GET /messages/coach/:studentId
   */
  @Get('coach/:studentId')
  async getCoachStudentMessages(
    @Req() req: any,
    @Param('studentId') studentId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '100',
  ) {
    const coachId = Number(req.user.sub);
    const studentIdNum = Number(studentId);

    const [messages, total] = await this.msgRepo.findAndCount({
      where: { coachId, studentId: studentIdNum },
      order: { createdAt: 'ASC' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    });

    // 批量查询用户信息
    const userIds = new Set<number>();
    messages.forEach(m => {
      // 确保 coachId 和 studentId 转为数字
      userIds.add(Number(m.coachId));
      userIds.add(Number(m.studentId));
    });

    // 只有当有用户 ID 时才查询
    const users = userIds.size > 0
      ? await this.userRepo
          .createQueryBuilder('u')
          .where('u.id IN (:...userIds)', { userIds: Array.from(userIds) })
          .getMany()
      : [];

    const userMap = new Map(users.map(u => [u.id, u]));

    // 组装数据，动态补充 name 字段
    const items = messages.map(m => {
      // 确保 key 是数字类型
      const coachIdNum = Number(m.coachId);
      const studentIdNum = Number(m.studentId);
      const coach = userMap.get(coachIdNum);
      const student = userMap.get(studentIdNum);
      const isFromCoach = m.sender === MessageSender.coach;

      return {
        id: m.id,
        coachId: m.coachId,
        studentId: m.studentId,
        sender: m.sender,
        senderId: isFromCoach ? m.coachId : m.studentId,
        senderName: isFromCoach ? coach?.name : student?.name,
        receiverId: isFromCoach ? m.studentId : m.coachId,
        receiverName: isFromCoach ? student?.name : coach?.name,
        content: m.content,
        type: m.type,
        createdAt: m.createdAt,
        readAt: m.readAt,
      };
    });

    return { items, total };
  }

  /**
   * 获取与某个教练的聊天记录
   *
   * GET /messages/student/:coachId
   */
  @Get('student/:coachId')
  async getStudentCoachMessages(
    @Req() req: any,
    @Param('coachId') coachId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '100',
  ) {
    const studentId = Number(req.user.sub);
    const coachIdNum = Number(coachId);

    const [messages, total] = await this.msgRepo.findAndCount({
      where: { coachId: coachIdNum, studentId },
      order: { createdAt: 'ASC' },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
    });

    const userIds = new Set<number>();
    messages.forEach(m => {
      userIds.add(Number(m.coachId));
      userIds.add(Number(m.studentId));
    });

    const users = userIds.size > 0
      ? await this.userRepo
          .createQueryBuilder('u')
          .where('u.id IN (:...userIds)', { userIds: Array.from(userIds) })
          .getMany()
      : [];

    const userMap = new Map(users.map(u => [u.id, u]));

    const items = messages.map(m => {
      const coachIdNum = Number(m.coachId);
      const studentIdNum = Number(m.studentId);
      const coach = userMap.get(coachIdNum);
      const student = userMap.get(studentIdNum);
      const isFromCoach = m.sender === MessageSender.coach;

      return {
        id: m.id,
        coachId: m.coachId,
        studentId: m.studentId,
        sender: m.sender,
        senderId: isFromCoach ? m.coachId : m.studentId,
        senderName: isFromCoach ? coach?.name : student?.name,
        receiverId: isFromCoach ? m.studentId : m.coachId,
        receiverName: isFromCoach ? student?.name : coach?.name,
        content: m.content,
        type: m.type,
        createdAt: m.createdAt,
        readAt: m.readAt,
      };
    });

    return { items, total };
  }

  /**
   * 发送消息（教练端）
   *
   * POST /messages/coach/send
   */
  @Post('coach/send')
  async sendFromCoach(@Req() req: any, @Body() body: any) {
    // body: { studentId, content, type }
    const student = await this.users.findById(Number(body.studentId));
    if (!student) throw new Error('Student not found');

    const coach = await this.users.findById(Number(req.user.sub));
    if (!coach) throw new Error('Coach not found');

    const message = await this.chat.sendMessage({
      coachId: coach.id,
      studentId: student.id,
      senderId: coach.id,
      senderName: coach.name,
      content: body.content,
      type: body.type || MessageType.text,
    });

    await this.chatGateway.notifyNewMessage(coach.id, student.id, {
      id: message.id,
      coachId: message.coachId,
      studentId: message.studentId,
      sender: message.sender,
      senderId: coach.id,
      senderName: coach.name,
      receiverId: student.id,
      receiverName: student.name,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() || null,
    });

    return message;
  }

  /**
   * 发送消息（学员端）
   *
   * POST /messages/student/send
   */
  @Post('student/send')
  async sendFromStudent(@Req() req: any, @Body() body: any) {
    // body: { coachId, content, type }
    const coach = await this.users.findById(Number(body.coachId));
    if (!coach) throw new Error('Coach not found');

    const student = await this.users.findById(Number(req.user.sub));
    if (!student) throw new Error('Student not found');

    const message = await this.chat.sendMessage({
      coachId: coach.id,
      studentId: student.id,
      senderId: student.id,
      senderName: student.name,
      content: body.content,
      type: body.type || MessageType.text,
    });

    await this.chatGateway.notifyNewMessage(coach.id, student.id, {
      id: message.id,
      coachId: message.coachId,
      studentId: message.studentId,
      sender: message.sender,
      senderId: student.id,
      senderName: student.name,
      receiverId: coach.id,
      receiverName: coach.name,
      content: message.content,
      type: message.type,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() || null,
    });

    return message;
  }

  /**
   * 标记消息为已读
   *
   * POST /messages/coach/:studentId/read
   */
  @Post('coach/:studentId/read')
  async markCoachStudentRead(@Req() req: any, @Param('studentId') studentId: string) {
    const coachId = Number(req.user.sub);
    const studentIdNum = Number(studentId);

    // 修改：使用 sender 判断而非 receiver_id
    // 标记学员发送的消息为已读
    await this.msgRepo
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: () => 'CURRENT_TIMESTAMP' })
      .where('coach_id = :coachId', { coachId })
      .andWhere('student_id = :studentId', { studentId: studentIdNum })
      .andWhere('sender = :sender', { sender: MessageSender.student })
      .andWhere('read_at IS NULL')
      .execute();

    return { ok: true };
  }

  /**
   * 标记消息为已读（学员端）
   *
   * POST /messages/student/:coachId/read
   */
  @Post('student/:coachId/read')
  async markStudentCoachRead(@Req() req: any, @Param('coachId') coachId: string) {
    const studentId = Number(req.user.sub);
    const coachIdNum = Number(coachId);

    await this.msgRepo
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: () => 'CURRENT_TIMESTAMP' })
      .where('student_id = :studentId', { studentId })
      .andWhere('coach_id = :coachId', { coachId: coachIdNum })
      .andWhere('sender = :sender', { sender: MessageSender.coach })
      .andWhere('read_at IS NULL')
      .execute();

    return { ok: true };
  }

  /**
   * 获取在线状态
   */
  @Get('online-status')
  async getOnlineStatus(@Query('userIds') userIds?: string) {
    const ids = userIds ? userIds.split(',').map((id) => parseInt(id)) : [];
    const onlineUserIds = this.chatGateway.getOnlineUsers();

    const status: Record<string, boolean> = {};
    for (const id of ids) {
      status[id.toString()] = onlineUserIds.includes(id);
    }

    return {
      onlineUsers: onlineUserIds,
      userStatus: status,
    };
  }
}
