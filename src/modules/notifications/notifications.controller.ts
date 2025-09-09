import { Body, Controller, Delete, Get, Patch, Post, Query, Req, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';

class MarkAsReadDto {
  notificationIds?: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  // 获取用户通知列表
  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('status') status?: 'unread' | 'read',
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const onlyUnread = status === 'unread' ? true : undefined;
    const { items, total } = await this.svc.getUserNotifications(req.user.sub, p, ps, onlyUnread);
    return { items, total, page: p, pageSize: ps };
  }

  // 获取未读通知数量
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.svc.getUnreadCount(req.user.sub);
    return { count };
  }

  // 标记单个通知为已读
  @Patch(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    const success = await this.svc.markAsRead(req.user.sub, id);
    return { success };
  }

  // 批量标记为已读（全部已读）
  @Patch('mark-all-read')
  async markAllAsRead(@Req() req: any) {
    const count = await this.svc.markAllAsRead(req.user.sub);
    return { markedCount: count };
  }

  // 删除通知
  @Delete(':id')
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    const success = await this.svc.deleteNotification(req.user.sub, id);
    return { success };
  }
}
