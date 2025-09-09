import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';

interface CreateNotificationData {
  userId: number | string;
  type: NotificationType;
  title: string;
  content: string;
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
      userId: Number(data.userId),
      type: data.type,
      title: data.title,
      content: data.content,
      readAt: null,
    });
    return this.repo.save(notification);
  }

  // 批量创建通知（给多个用户发送相同通知）
  async createBulkNotifications(userIds: Array<number | string>, data: Omit<CreateNotificationData, 'userId'>): Promise<Notification[]> {
    const notifications = userIds.map(userId => this.repo.create({
      userId: Number(userId),
      type: data.type,
      title: data.title,
      content: data.content,
      readAt: null,
    }));
    return this.repo.save(notifications);
  }

  // 获取用户的通知列表
  async getUserNotifications(
    userId: number | string,
    page: number = 1,
    pageSize: number = 20,
    onlyUnread?: boolean
  ): Promise<{ items: Notification[]; total: number }> {
    const qb = this.repo.createQueryBuilder('n')
      .where('n.userId = :userId', { userId: Number(userId) })
      .orderBy('n.createdAt', 'DESC');

    if (onlyUnread) {
      qb.andWhere('n.readAt IS NULL');
    }

    qb.skip((page - 1) * pageSize).take(pageSize);
    
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // 标记通知为已读
  async markAsRead(userId: number | string, notificationId: number | string): Promise<boolean> {
    const result = await this.repo.update(
      { id: Number(notificationId), userId: Number(userId) },
      { readAt: new Date() }
    );
    return (result.affected || 0) > 0;
  }

  // 批量标记为已读
  async markAllAsRead(userId: number | string): Promise<number> {
    const result = await this.repo.createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'CURRENT_TIMESTAMP' })
      .where('user_id = :uid AND read_at IS NULL', { uid: Number(userId) })
      .execute();
    return result.affected || 0;
  }

  // 删除通知
  async deleteNotification(userId: number | string, notificationId: number | string): Promise<boolean> {
    const result = await this.repo.delete({ id: Number(notificationId), userId: Number(userId) });
    return (result.affected || 0) > 0;
  }

  // 获取未读通知数量
  async getUnreadCount(userId: number | string): Promise<number> {
    return this.repo.count({
      where: { userId: Number(userId), readAt: null as any },
    });
  }

  // 便民方法：发送预约通知
  async sendAppointmentNotification(
    userId: number | string,
    appointmentId: number | string,
    title: string,
    content: string
  ): Promise<Notification> {
    return this.createNotification({
      userId: Number(userId),
      type: NotificationType.appointment,
      title,
      content,
    });
  }

  // 便民方法：发送消息通知
  async sendMessageNotification(
    userId: number | string,
    messageId: number | string,
    senderName: string,
    content: string
  ): Promise<Notification> {
    return this.createNotification({
      userId: Number(userId),
      type: NotificationType.message,
      title: `来自 ${senderName} 的消息`,
      content,
    });
  }

  // 便民方法：发送邀约通知
  async sendInviteNotification(
    userId: number | string,
    coachName: string
  ): Promise<Notification> {
    return this.createNotification({
      userId: Number(userId),
      type: NotificationType.system,
      title: '收到新的学习邀约',
      content: `${coachName} 邀请您参加驾驶培训`,
    });
  }

  // 便民方法：发送系统通知
  async sendSystemNotification(
    userId: number | string,
    title: string,
    content: string,
  ): Promise<Notification> {
    return this.createNotification({
      userId: Number(userId),
      type: NotificationType.system,
      title,
      content,
    });
  }
}
