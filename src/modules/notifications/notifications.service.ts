import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType, NotificationStatus } from './notification.entity';

interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  data?: any;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  // 创建通知 - 核心方法供其他地方调用
  async createNotification(data: CreateNotificationData): Promise<Notification> {
    const notification = this.repo.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      content: data.content,
      data: data.data,
      actionUrl: data.actionUrl,
      status: NotificationStatus.unread,
    });
    
    return this.repo.save(notification);
  }

  // 批量创建通知（给多个用户发送相同通知）
  async createBulkNotifications(userIds: string[], data: Omit<CreateNotificationData, 'userId'>): Promise<Notification[]> {
    const notifications = userIds.map(userId => 
      this.repo.create({
        userId,
        type: data.type,
        title: data.title,
        content: data.content,
        data: data.data,
        actionUrl: data.actionUrl,
        status: NotificationStatus.unread,
      })
    );
    
    return this.repo.save(notifications);
  }

  // 获取用户的通知列表
  async getUserNotifications(
    userId: string, 
    page: number = 1, 
    pageSize: number = 20,
    status?: NotificationStatus
  ): Promise<{ items: Notification[]; total: number }> {
    const qb = this.repo.createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.status != :deleted', { deleted: NotificationStatus.deleted })
      .orderBy('n.createdAt', 'DESC');

    if (status) {
      qb.andWhere('n.status = :status', { status });
    }

    qb.skip((page - 1) * pageSize).take(pageSize);
    
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // 标记通知为已读
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.repo.update(
      { id: notificationId, userId },
      { status: NotificationStatus.read }
    );
    return result.affected! > 0;
  }

  // 批量标记为已读
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, status: NotificationStatus.unread },
      { status: NotificationStatus.read }
    );
    return result.affected || 0;
  }

  // 删除通知
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.repo.update(
      { id: notificationId, userId },
      { status: NotificationStatus.deleted }
    );
    return result.affected! > 0;
  }

  // 获取未读通知数量
  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.count({
      where: {
        userId,
        status: NotificationStatus.unread,
      },
    });
  }

  // 便民方法：发送预约通知
  async sendAppointmentNotification(
    userId: string,
    appointmentId: string,
    title: string,
    content: string
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.appointment,
      title,
      content,
      data: { appointmentId },
      actionUrl: `/appointments/${appointmentId}`,
    });
  }

  // 便民方法：发送消息通知
  async sendMessageNotification(
    userId: string,
    messageId: string,
    senderName: string,
    content: string
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.message,
      title: `来自 ${senderName} 的消息`,
      content,
      data: { messageId },
      actionUrl: `/messages/${messageId}`,
    });
  }

  // 便民方法：发送邀约通知
  async sendInviteNotification(
    userId: string,
    inviteId: string,
    coachName: string
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.invite,
      title: '收到新的学习邀约',
      content: `${coachName} 邀请您参加驾驶培训`,
      data: { inviteId },
      actionUrl: `/invites/${inviteId}`,
    });
  }

  // 便民方法：发送系统通知
  async sendSystemNotification(
    userId: string,
    title: string,
    content: string,
    actionUrl?: string
  ): Promise<Notification> {
    return this.createNotification({
      userId,
      type: NotificationType.system,
      title,
      content,
      actionUrl,
    });
  }
}