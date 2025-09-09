import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import { Appointment, AppointmentStatus, AppointmentType } from './appointment.entity';
import { UsersService } from '../users/users.service';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment) private readonly repo: Repository<Appointment>,
    private readonly users: UsersService,
    private readonly messages: MessagesService,
  ) {}

  async listForUser(userId: number, role: 'student' | 'coach', from?: Date, to?: Date, status?: AppointmentStatus) {
    const where: any = role === 'student' ? { studentId: userId } : { coachId: userId };
    if (from && to) {
      where.startTime = Between(from, to);
    }
    if (status) where.status = status;
    return this.repo.find({ where, order: { startTime: 'ASC' }, relations: ['student', 'coach'] });
  }

  async getById(id: number, userId: number) {
    const a = await this.repo.findOne({ where: { id }, relations: ['student', 'coach'] });
    if (!a) throw new NotFoundException('预约不存在');
    if (a.studentId !== userId && a.coachId !== userId) throw new ForbiddenException();
    return a;
  }

  async create(data: {
    studentId: number; coachId: number | string; startTime: Date; endTime: Date;
    type?: AppointmentType; notes?: string; location?: string;
  }) {
    await this._validateRules(data.startTime, data.endTime);
    const student = await this.users.findById(data.studentId);
    if (!student) throw new BadRequestException('学员不存在');

    // 处理教练ID - 如果传入的是'school_admin'，则查找学员绑定的教练
    let coach: any;
    if (data.coachId === 'school_admin' || typeof data.coachId === 'string') {
      // 先查找学员绑定的教练
      coach = await this.users.getCoachForStudent(data.studentId);
      
      if (!coach && student.schoolId) {
        // 如果没有绑定教练，查找该学校的教练
        coach = await this.users.findCoachBySchoolId(student.schoolId);
        
        // 自动绑定学员到教练
        if (coach) {
          await this.users.assignStudentToCoach(data.studentId, coach.id);
        }
      }
      
      if (!coach) {
        throw new BadRequestException('未找到可用教练');
      }
    } else {
      coach = await this.users.findById(data.coachId as number);
      if (!coach) throw new BadRequestException('教练不存在');
    }

    await this._ensureNoConflict(coach.id, data.startTime, data.endTime);
    const a = this.repo.create({
      studentId: student.id,
      coachId: coach.id,
      startTime: data.startTime, 
      endTime: data.endTime,
      type: data.type ?? AppointmentType.regular,
      notes: data.notes ?? null,
      location: data.location ?? null,
      status: AppointmentStatus.pending,
    });
    const saved = await this.repo.save(a);
    
    // 通知教练
    const conv = await this.messages.getOrCreateConversation(student.id, student.name, coach.id, coach.name);
    await this.messages.sendMessage({
      conversationId: conv.id,
      senderId: student.id,
      senderName: student.name,
      receiverId: coach.id,
      receiverName: coach.name,
      content: `学员 ${student.name} 提交了预约申请：${a.startTime.toISOString()} - ${a.endTime.toISOString()}`,
    });
    return saved;
  }

  async confirm(id: number, coachId: number, coachNotes?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('预约不存在');
    if (a.coachId !== coachId) throw new ForbiddenException();
    if (a.status !== AppointmentStatus.pending) throw new BadRequestException('仅能确认待处理预约');
    await this._ensureNoConflict(a.coachId, a.startTime, a.endTime, id);
    a.status = AppointmentStatus.confirmed;
    a.coachNotes = coachNotes ?? a.coachNotes;
    const saved = await this.repo.save(a);
    // 通知学员 - 需要加载关联数据
    const appointment = await this.repo.findOne({ where: { id }, relations: ['student', 'coach'] });
    if (appointment) {
      const conv = await this.messages.getOrCreateConversation(appointment.student.id, appointment.student.name, appointment.coach.id, appointment.coach.name);
      await this.messages.sendMessage({
        conversationId: conv.id,
        senderId: appointment.coach.id,
        senderName: appointment.coach.name,
        receiverId: appointment.student.id,
        receiverName: appointment.student.name,
        content: `你的预约已被教练确认：${a.startTime.toISOString()} - ${a.endTime.toISOString()}`,
      });
    }
    return saved;
  }

  async reject(id: number, coachId: number, reason?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('预约不存在');
    if (a.coachId !== coachId) throw new ForbiddenException();
    if (a.status !== AppointmentStatus.pending) throw new BadRequestException('仅能拒绝待处理预约');
    a.status = AppointmentStatus.rejected;
    a.coachNotes = reason ?? a.coachNotes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({ where: { id }, relations: ['student', 'coach'] });
    if (appointment) {
      const conv = await this.messages.getOrCreateConversation(appointment.student.id, appointment.student.name, appointment.coach.id, appointment.coach.name);
      await this.messages.sendMessage({
        conversationId: conv.id,
        senderId: appointment.coach.id.toString(),
        senderName: appointment.coach.name,
        receiverId: appointment.student.id.toString(),
        receiverName: appointment.student.name,
        content: `你的预约被拒绝：${reason ?? ''}`,
      });
    }
    return saved;
  }

  async cancel(id: number, userId: number, notes?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('预约不存在');
    if (a.studentId !== userId && a.coachId !== userId) throw new ForbiddenException();
    if (a.status === AppointmentStatus.completed) throw new BadRequestException('已完成不可取消');
    // 简单规则：开始前2小时内不可取消
    if (a.startTime.getTime() - Date.now() < 2 * 60 * 60 * 1000) {
      throw new BadRequestException('距开始不足2小时不可取消');
    }
    a.status = AppointmentStatus.cancelled;
    a.notes = notes ?? a.notes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({ where: { id }, relations: ['student', 'coach'] });
    if (appointment) {
      const otherId = userId === a.studentId ? a.coachId : a.studentId;
      const otherName = userId === a.studentId ? appointment.coach.name : appointment.student.name;
      const meName = userId === a.studentId ? appointment.student.name : appointment.coach.name;
      const conv = await this.messages.getOrCreateConversation(appointment.student.id.toString(), appointment.student.name, appointment.coach.id.toString(), appointment.coach.name);
      await this.messages.sendMessage({
        conversationId: conv.id,
        senderId: userId.toString(),
        senderName: meName,
        receiverId: otherId.toString(),
        receiverName: otherName,
        content: `${meName} 取消了预约：${a.startTime.toISOString()} - ${a.endTime.toISOString()}`,
      });
    }
    return saved;
  }

  async complete(id: number, coachId: number, coachNotes?: string, studentNotes?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('预约不存在');
    if (a.coachId !== coachId) throw new ForbiddenException();
    if (a.status !== AppointmentStatus.confirmed) throw new BadRequestException('仅能完成已确认的预约');
    a.status = AppointmentStatus.completed;
    a.coachNotes = coachNotes ?? a.coachNotes;
    a.studentNotes = studentNotes ?? a.studentNotes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({ where: { id }, relations: ['student', 'coach'] });
    if (appointment) {
      const conv = await this.messages.getOrCreateConversation(appointment.student.id.toString(), appointment.student.name, appointment.coach.id.toString(), appointment.coach.name);
      await this.messages.sendMessage({
        conversationId: conv.id,
        senderId: appointment.coach.id,
        senderName: appointment.coach.name,
        receiverId: appointment.student.id,
        receiverName: appointment.student.name,
        content: `课程已完成，教练备注：${coachNotes ?? ''}`,
      });
    }
    return saved;
  }

  async reschedule(id: number, coachId: number, startTime: Date, endTime: Date, notes?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('预约不存在');
    if (a.coachId !== coachId) throw new ForbiddenException();
    await this._validateRules(startTime, endTime);
    await this._ensureNoConflict(a.coachId, startTime, endTime, id);
    a.startTime = startTime;
    a.endTime = endTime;
    a.notes = notes ?? a.notes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({ where: { id }, relations: ['student', 'coach'] });
    if (appointment) {
      const conv = await this.messages.getOrCreateConversation(appointment.student.id, appointment.student.name, appointment.coach.id, appointment.coach.name);
      await this.messages.sendMessage({
        conversationId: conv.id,
        senderId: appointment.coach.id,
        senderName: appointment.coach.name,
        receiverId: appointment.student.id,
        receiverName: appointment.student.name,
        content: `课程时间已改期：${a.startTime.toISOString()} - ${a.endTime.toISOString()}`,
      });
    }
    return saved;
  }

  async slots(coachId: number, date: Date) {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    const dayApps = await this.repo.find({ where: { coachId, startTime: Between(start, end), status: MoreThanOrEqual('pending') as any }, order: { startTime: 'ASC' } });
    const slots: { startTime: string; endTime: string; isAvailable: boolean; reason?: string }[] = [];
    for (let h=9; h<18; h++) {
      for (let m=0; m<60; m+=30) {
        const s = new Date(date); s.setHours(h, m, 0, 0);
        const e = new Date(s.getTime() + 30*60000);
        const expired = s.getTime() < Date.now();
        const conflict = dayApps.some(a => s < a.endTime && e > a.startTime && a.status !== AppointmentStatus.cancelled && a.status !== AppointmentStatus.rejected);
        slots.push({ startTime: s.toISOString(), endTime: e.toISOString(), isAvailable: !expired && !conflict, reason: conflict ? '已被预约' : (expired ? '时间已过' : undefined) });
      }
    }
    return slots;
  }

  async stats(userId: number, role: 'student' | 'coach') {
    const list = await this.listForUser(userId, role);
    const total = list.length;
    const confirmed = list.filter(a => a.status === AppointmentStatus.confirmed).length;
    const completed = list.filter(a => a.status === AppointmentStatus.completed).length;
    const pending = list.filter(a => a.status === AppointmentStatus.pending).length;
    const cancelled = list.filter(a => a.status === AppointmentStatus.cancelled).length;
    const now = new Date();
    const thisMonth = list.filter(a => a.startTime.getFullYear()===now.getFullYear() && a.startTime.getMonth()===now.getMonth()).length;
    return { total, confirmed, completed, pending, cancelled, thisMonth };
  }

  private async _ensureNoConflict(coachId: number, startTime: Date, endTime: Date, ignoreId?: number) {
    const qb = this.repo.createQueryBuilder('a')
      .where('a.coachId = :coachId', { coachId })
      .andWhere('(a.status IN (:...st))', { st: [AppointmentStatus.pending, AppointmentStatus.confirmed] })
      .andWhere('a.startTime < :endTime AND a.endTime > :startTime', { startTime, endTime });
    if (ignoreId) qb.andWhere('a.id <> :ignoreId', { ignoreId });
    const exists = await qb.getOne();
    if (exists) throw new BadRequestException('所选时间与现有约课冲突');
  }

  private async _validateRules(startTime: Date, endTime: Date) {
    const now = new Date();
    if (startTime.getTime() < now.getTime()) throw new BadRequestException('不能预约过去的时间');
    const max = new Date(now.getTime() + 30*24*60*60*1000);
    if (startTime.getTime() > max.getTime()) throw new BadRequestException('最多提前30天预约');
    if (startTime.getTime() - now.getTime() < 2*60*60*1000) throw new BadRequestException('请至少提前2小时预约');
    const dur = endTime.getTime() - startTime.getTime();
    if (dur < 30*60*1000) throw new BadRequestException('课程时长至少30分钟');
    if (dur > 3*60*60*1000) throw new BadRequestException('单次课程时长不能超过3小时');
  }
}
