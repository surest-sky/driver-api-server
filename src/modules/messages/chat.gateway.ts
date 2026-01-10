import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatService } from './chat.service';
import { MessageType, MessageSender } from './message.entity';
import { User } from '../users/user.entity';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userName?: string;
}

interface JoinRoomData {
  coachId: string;
  studentId: string;
}

interface SendMessageData {
  coachId: string;
  studentId: string;
  content: string;
  type?: MessageType;
}

interface TypingData {
  coachId: string;
  studentId: string;
  isTyping: boolean;
}

interface MessageReadData {
  coachId: string;
  studentId: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private onlineUsers = new Map<number, AuthenticatedSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // 从查询参数中获取 token
      const token = client.handshake.query.token as string;
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // 验证 JWT token
      const payload = await this.jwtService.verifyAsync(token);
      if (!payload || !payload.sub) {
        this.logger.warn(`Invalid token for client ${client.id}`);
        client.disconnect();
        return;
      }

      // 设置用户信息
      client.userId = parseInt(payload.sub);
      client.userName = payload.username || payload.name || `User ${payload.sub}`;

      // 添加到在线用户列表
      this.onlineUsers.set(client.userId, client);

      this.logger.log(`User ${client.userName}(${client.userId}) connected`);

      // 广播用户上线事件
      this.server.emit('user_online', {
        userId: client.userId,
        userName: client.userName,
        timestamp: new Date().toISOString(),
      });

      // 发送连接成功确认
      client.emit('connection_success', {
        userId: client.userId,
        userName: client.userName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.onlineUsers.delete(client.userId);
      this.logger.log(`User ${client.userName}(${client.userId}) disconnected`);

      // 广播用户离线事件
      this.server.emit('user_offline', {
        userId: client.userId,
        userName: client.userName,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取在线用户列表
   */
  getOnlineUsers(): number[] {
    return Array.from(this.onlineUsers.keys());
  }

  /**
   * 加入聊天房间
   *
   * 房间命名规则：chat_{coachId}_{studentId}
   */
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinRoomData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    const coachId = parseInt(data.coachId);
    const studentId = parseInt(data.studentId);

    // 验证用户是否是聊天参与者
    if (client.userId !== coachId && client.userId !== studentId) {
      return { error: 'Forbidden' };
    }

    const roomName = `chat_${coachId}_${studentId}`;
    client.join(roomName);

    this.logger.log(`User ${client.userName} joined room ${roomName}`);

    return {
      success: true,
      room: roomName,
      coachId,
      studentId,
    };
  }

  /**
   * 离开聊天房间
   */
  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinRoomData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    const roomName = `chat_${data.coachId}_${data.studentId}`;
    client.leave(roomName);

    this.logger.log(`User ${client.userName} left room ${roomName}`);

    return { success: true };
  }

  /**
   * 发送消息
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const coachId = parseInt(data.coachId);
      const studentId = parseInt(data.studentId);

      // 验证用户是否是聊天参与者
      if (client.userId !== coachId && client.userId !== studentId) {
        return { error: 'Forbidden' };
      }

      const message = await this.chatService.sendMessage({
        coachId,
        studentId,
        senderId: client.userId,
        senderName: client.userName!,
        content: data.content,
        type: data.type || MessageType.text,
      });

      // 查询用户信息以补充 name 字段
      const coach = await this.userRepo.findOne({ where: { id: coachId } });
      const student = await this.userRepo.findOne({ where: { id: studentId } });

      // 构造消息数据（包含兼容前端的字段）
      const isFromCoach = message.sender === MessageSender.coach;
      const messageData = {
        id: message.id,
        coachId: message.coachId,
        studentId: message.studentId,
        sender: message.sender,
        senderId: isFromCoach ? coachId : studentId,
        senderName: isFromCoach ? coach?.name : student?.name,
        receiverId: isFromCoach ? studentId : coachId,
        receiverName: isFromCoach ? student?.name : coach?.name,
        content: message.content,
        type: message.type,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString() || null,
      };

      // 发送给聊天房间的所有用户
      const roomName = `chat_${coachId}_${studentId}`;
      this.server.to(roomName).emit('new_message', {
        type: 'message',
        data: messageData,
        room: roomName,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Message sent from ${client.userId} in room ${roomName}`);

      return { success: true, message: messageData };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { error: 'Failed to send message' };
    }
  }

  /**
   * 输入状态
   */
  @SubscribeMessage('typing_status')
  async handleTypingStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const roomName = `chat_${data.coachId}_${data.studentId}`;
      client.to(roomName).emit('typing_status', {
        type: 'typing',
        data: {
          userId: client.userId,
          userName: client.userName,
          isTyping: data.isTyping,
        },
        room: roomName,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling typing status: ${error.message}`);
      return { error: 'Failed to handle typing status' };
    }
  }

  /**
   * 消息已读
   */
  @SubscribeMessage('message_read')
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MessageReadData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      // 标记消息为已读（这个功能暂时保留，但实际实现需要在 controller 中）
      const roomName = `chat_${data.coachId}_${data.studentId}`;
      client.to(roomName).emit('message_read', {
        type: 'read',
        room: roomName,
        userId: client.userId,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling message read: ${error.message}`);
      return { error: 'Failed to handle message read' };
    }
  }

  /**
   * 通知新消息（外部调用）
   */
  async notifyNewMessage(coachId: number, studentId: number, messageData: any) {
    const roomName = `chat_${coachId}_${studentId}`;
    this.server.to(roomName).emit('new_message', {
      type: 'message',
      data: messageData,
      room: roomName,
      timestamp: new Date().toISOString(),
    });
  }
}
