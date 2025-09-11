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
import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from './messages.service';
import { MessageType } from './message.entity';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userName?: string;
}

interface JoinConversationData {
  conversationId: string;
  userId: string;
  userName: string;
}

interface SendMessageData {
  conversationId: string;
  receiverId: string;
  receiverName: string;
  content: string;
  type?: MessageType;
}

interface TypingData {
  conversationId: string;
  isTyping: boolean;
}

interface MessageReadData {
  conversationId: string;
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
    private readonly messagesService: MessagesService,
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
      this.logger.error(`Connection error for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.onlineUsers.delete(client.userId);
      this.logger.log(`User ${client.userName}(${client.userId}) disconnected`);

      // 广播用户下线事件
      this.server.emit('user_offline', {
        userId: client.userId,
        userName: client.userName,
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinConversationData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      // 加入对话房间
      const roomName = `conversation_${data.conversationId}`;
      await client.join(roomName);

      this.logger.log(`User ${client.userId} joined conversation ${data.conversationId}`);

      return { success: true, conversationId: data.conversationId };
    } catch (error) {
      this.logger.error(`Error joining conversation: ${error.message}`);
      return { error: 'Failed to join conversation' };
    }
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const roomName = `conversation_${data.conversationId}`;
      await client.leave(roomName);

      this.logger.log(`User ${client.userId} left conversation ${data.conversationId}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error leaving conversation: ${error.message}`);
      return { error: 'Failed to leave conversation' };
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      // 保存消息到数据库
      const message = await this.messagesService.sendMessage({
        conversationId: data.conversationId,
        senderId: client.userId,
        senderName: client.userName!,
        receiverId: data.receiverId,
        receiverName: data.receiverName,
        content: data.content,
        type: data.type || MessageType.text,
      });

      // 构造消息数据
      const messageData = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderName: message.senderName,
        receiverId: message.receiverId,
        receiverName: message.receiverName,
        content: message.content,
        type: message.type,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString() || null,
      };

      // 发送给对话房间的所有用户
      const roomName = `conversation_${data.conversationId}`;
      this.server.to(roomName).emit('new_message', {
        type: 'message',
        data: messageData,
        sessionId: data.conversationId,
        timestamp: new Date().toISOString(),
      });

      // 如果接收者在线但不在房间中，直接发送通知
      const receiverSocket = this.onlineUsers.get(parseInt(data.receiverId));
      if (receiverSocket && !receiverSocket.rooms.has(roomName)) {
        receiverSocket.emit('new_message', {
          type: 'message',
          data: messageData,
          sessionId: data.conversationId,
          timestamp: new Date().toISOString(),
        });
      }

      this.logger.log(`Message sent from ${client.userId} to conversation ${data.conversationId}`);

      return { success: true, message: messageData };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { error: 'Failed to send message' };
    }
  }

  @SubscribeMessage('typing_status')
  async handleTypingStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      // 发送输入状态到对话房间（排除自己）
      const roomName = `conversation_${data.conversationId}`;
      client.to(roomName).emit('typing_status', {
        type: 'typing',
        data: {
          userId: client.userId,
          userName: client.userName,
          isTyping: data.isTyping,
        },
        sessionId: data.conversationId,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling typing status: ${error.message}`);
      return { error: 'Failed to handle typing status' };
    }
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MessageReadData,
  ) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    try {
      // 标记消息为已读
      await this.messagesService.markReadByUser(data.conversationId, client.userId.toString());

      // 通知对话房间的其他用户
      const roomName = `conversation_${data.conversationId}`;
      client.to(roomName).emit('message_read', {
        type: 'read',
        data: {
          userId: client.userId,
          userName: client.userName,
        },
        sessionId: data.conversationId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Messages marked as read by user ${client.userId} in conversation ${data.conversationId}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
      return { error: 'Failed to mark messages as read' };
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
    // 简单的心跳响应
    client.emit('heartbeat_response', {
      timestamp: new Date().toISOString(),
    });
    return { success: true };
  }

  @SubscribeMessage('get_online_users')
  handleGetOnlineUsers(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      return { error: 'Unauthorized' };
    }

    const onlineUsersList = Array.from(this.onlineUsers.values()).map(socket => ({
      userId: socket.userId,
      userName: socket.userName,
    }));

    return { success: true, users: onlineUsersList };
  }

  // 主动推送消息的方法（供其他服务调用）
  async notifyNewMessage(conversationId: string, messageData: any) {
    const roomName = `conversation_${conversationId}`;
    this.server.to(roomName).emit('new_message', {
      type: 'message',
      data: messageData,
      sessionId: conversationId,
      timestamp: new Date().toISOString(),
    });
  }

  // 获取在线用户状态
  isUserOnline(userId: number): boolean {
    return this.onlineUsers.has(userId);
  }

  // 获取所有在线用户
  getOnlineUsers(): number[] {
    return Array.from(this.onlineUsers.keys());
  }
}