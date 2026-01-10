import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AppointmentStatus, AppointmentType } from './appointment.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly svc: AppointmentsService) {}

  @Get('me')
  async list(@Req() req: any, @Query('role') role: 'student'|'coach', @Query('from') from?: string, @Query('to') to?: string, @Query('status') status?: AppointmentStatus) {
    const f = from ? new Date(from) : undefined;
    const t = to ? new Date(to) : undefined;
    return this.svc.listForUser(req.user.sub, role, f, t, status);
  }

  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    return this.svc.getById(+id, req.user.sub);
  }

  @Post()
  @Roles('student')
  async create(@Req() req: any, @Body() body: { coachId: string; startTime: string; endTime: string; type?: AppointmentType; notes?: string; location?: string; }) {
    return this.svc.create({
      studentId: req.user.sub,
      coachId: body.coachId,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      type: body.type,
      notes: body.notes,
      location: body.location,
    });
  }

  @Post('coach/create')
  @Roles('coach')
  async coachCreate(@Req() req: any, @Body() body: { studentId: string; startTime: string; endTime: string; type?: AppointmentType; notes?: string; location?: string; }) {
    return this.svc.create({
      studentId: +body.studentId,
      coachId: req.user.sub,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      type: body.type,
      notes: body.notes,
      location: body.location,
      initiator: 'coach', // 教练发起，直接设为 confirmed 状态
    });
  }

  @Post(':id/confirm')
  @Roles('coach')
  async confirm(@Req() req: any, @Param('id') id: string, @Body() body: { coachNotes?: string }) {
    return this.svc.confirm(+id, req.user.sub, body.coachNotes);
  }

  @Post(':id/reject')
  @Roles('coach')
  async reject(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.svc.reject(+id, req.user.sub, body.reason);
  }

  @Post(':id/cancel')
  async cancel(@Req() req: any, @Param('id') id: string, @Body() body: { notes?: string }) {
    return this.svc.cancel(+id, req.user.sub, body.notes);
  }

  @Post(':id/complete')
  @Roles('coach')
  async complete(@Req() req: any, @Param('id') id: string, @Body() body: { coachNotes?: string, studentNotes?: string }) {
    return this.svc.complete(+id, req.user.sub, body.coachNotes, body.studentNotes);
  }

  @Patch(':id/reschedule')
  @Roles('coach')
  async reschedule(@Req() req: any, @Param('id') id: string, @Body() body: { startTime: string; endTime: string; notes?: string }) {
    return this.svc.reschedule(+id, req.user.sub, new Date(body.startTime), new Date(body.endTime), body.notes);
  }

  // 更新备注（学员/教练/管理员）
  @Patch(':id/notes')
  @Roles('student', 'coach')
  async updateNotes(@Req() req: any, @Param('id') id: string, @Body() body: { notes: string }) {
    return this.svc.updateNotes(+id, req.user, body.notes);
  }

  // 评论列表
  @Get(':id/comments')
  async comments(@Req() req: any, @Param('id') id: string) {
    return this.svc.listComments(+id, req.user.sub);
  }

  // 发表评论（学员/教练均可）
  @Post(':id/comments')
  async addComment(@Req() req: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.svc.addComment(+id, req.user.sub, body.content);
  }

  @Get('slots/day')
  async slots(@Req() req: any, @Query('coachId') coachId: string, @Query('date') date: string) {
    return this.svc.slots(coachId, new Date(date), req.user.sub);
  }

  @Get('stats/me')
  async stats(@Req() req: any, @Query('role') role: 'student'|'coach') {
    return this.svc.stats(req.user.sub, role);
  }
}
