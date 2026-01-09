import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Between, MoreThanOrEqual, Repository } from "typeorm";
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
} from "./appointment.entity";
import { AppointmentCommentEntity } from "./appointment-comment.entity";
import { UsersService } from "../users/users.service";
import { Availability } from "../availability/availability.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { MessagesService } from "../messages/messages.service";

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    @InjectRepository(AppointmentCommentEntity)
    private readonly commentRepo: Repository<AppointmentCommentEntity>,
    private readonly users: UsersService,
    private readonly messages: MessagesService,
    @InjectRepository(Availability)
    private readonly availabilityRepo: Repository<Availability>,
  ) {}

  async listForUser(
    userId: number,
    role: "student" | "coach",
    from?: Date,
    to?: Date,
    status?: AppointmentStatus,
  ) {
    const where: any =
      role === "student" ? { studentId: userId } : { coachId: userId };
    if (from && to) {
      where.startTime = Between(from, to);
    }
    if (status) where.status = status;
    return this.repo.find({
      where,
      order: { startTime: "ASC" },
      relations: ["student", "coach"],
    });
  }

  async getById(id: number, userId: number) {
    const a = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (!a) throw new NotFoundException("预约不存在");
    if (a.studentId !== userId && a.coachId !== userId)
      throw new ForbiddenException();
    return a;
  }

  async create(data: {
    studentId: number;
    coachId: number | string;
    startTime: Date;
    endTime: Date;
    type?: AppointmentType;
    notes?: string;
    location?: string;
    initiator?: "student" | "coach";
  }) {
    await this._validateRules(data.startTime, data.endTime);
    const student = await this.users.findById(data.studentId);
    if (!student) throw new BadRequestException("学员不存在");

    // 处理教练ID - 如果传入的是'school_admin'，则查找学员绑定的教练
    let coach: any;
    if (data.coachId === "school_admin" || typeof data.coachId === "string") {
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
        throw new BadRequestException("未找到可用教练");
      }
    } else {
      coach = await this.users.findById(data.coachId as number);
      if (!coach) throw new BadRequestException("教练不存在");
    }

    await this._ensureNoConflict(coach.id, data.startTime, data.endTime);

    // 根据发起者设置初始状态
    const initialStatus = data.initiator === "coach"
        ? AppointmentStatus.confirmed
        : AppointmentStatus.pending;

    const a = this.repo.create({
      studentId: student.id,
      coachId: coach.id,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type ?? AppointmentType.regular,
      notes: data.notes ?? null,
      location: data.location ?? null,
      status: initialStatus,
    });
    const saved = await this.repo.save(a);

    // 如果是教练发起且已确认，通知学员（而不是教练）
    if (data.initiator === "coach" && initialStatus === AppointmentStatus.confirmed) {
      try {
        const conv = await this.messages.getOrCreateConversation(
          coach.id,
          coach.name,
          student.id,
          student.name,
        );
        await this.messages.sendMessage({
          conversationId: conv.id,
          senderId: coach.id,
          senderName: coach.name,
          receiverId: student.id,
          receiverName: student.name,
          content: `教练 ${coach.name} 为您安排了课程：${a.startTime.toISOString()} - ${a.endTime.toISOString()}`,
        });
      } catch (e) {
        console.warn("appointments.create: notify student failed", e);
      }
    } else {
      // 学员发起，通知教练
      try {
        const conv = await this.messages.getOrCreateConversation(
          student.id,
          student.name,
          coach.id,
          coach.name,
        );
        await this.messages.sendMessage({
          conversationId: conv.id,
          senderId: student.id,
          senderName: student.name,
          receiverId: coach.id,
          receiverName: coach.name,
          content: `学员 ${student.name} 提交了预约申请：${a.startTime.toISOString()} - ${a.endTime.toISOString()}`,
        });
      } catch (e) {
        console.warn("appointments.create: notify coach failed", e);
      }
    }
    return saved;
  }

  async confirm(id: number, coachId: number, coachNotes?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException("预约不存在");
    if (a.coachId !== coachId) throw new ForbiddenException();
    if (a.status !== AppointmentStatus.pending)
      throw new BadRequestException("仅能确认待处理预约");
    await this._ensureNoConflict(a.coachId, a.startTime, a.endTime, id);
    a.status = AppointmentStatus.confirmed;
    a.coachNotes = coachNotes ?? a.coachNotes;
    const saved = await this.repo.save(a);
    // 通知学员 - 需要加载关联数据
    const appointment = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (appointment) {
      const conv = await this.messages.getOrCreateConversation(
        appointment.student.id,
        appointment.student.name,
        appointment.coach.id,
        appointment.coach.name,
      );
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
    if (!a) throw new NotFoundException("预约不存在");
    if (a.coachId !== coachId) throw new ForbiddenException();
    if (a.status !== AppointmentStatus.pending)
      throw new BadRequestException("仅能拒绝待处理预约");
    a.status = AppointmentStatus.rejected;
    a.coachNotes = reason ?? a.coachNotes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (appointment) {
      const conv = await this.messages.getOrCreateConversation(
        appointment.student.id,
        appointment.student.name,
        appointment.coach.id,
        appointment.coach.name,
      );
      await this.messages.sendMessage({
        conversationId: conv.id,
        senderId: appointment.coach.id.toString(),
        senderName: appointment.coach.name,
        receiverId: appointment.student.id.toString(),
        receiverName: appointment.student.name,
        content: `你的预约被拒绝：${reason ?? ""}`,
      });
    }
    return saved;
  }

  async cancel(id: number, userId: number, notes?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException("预约不存在");
    if (a.studentId !== userId && a.coachId !== userId)
      throw new ForbiddenException();
    if (a.status === AppointmentStatus.completed)
      throw new BadRequestException("已完成不可取消");
    // 简单规则：开始前2小时内不可取消
    if (a.startTime.getTime() - Date.now() < 2 * 60 * 60 * 1000) {
      throw new BadRequestException("距开始不足2小时不可取消");
    }
    a.status = AppointmentStatus.cancelled;
    a.notes = notes ?? a.notes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (appointment) {
      const otherId = userId === a.studentId ? a.coachId : a.studentId;
      const otherName =
        userId === a.studentId
          ? appointment.coach.name
          : appointment.student.name;
      const meName =
        userId === a.studentId
          ? appointment.student.name
          : appointment.coach.name;
      const conv = await this.messages.getOrCreateConversation(
        appointment.student.id.toString(),
        appointment.student.name,
        appointment.coach.id.toString(),
        appointment.coach.name,
      );
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

  async complete(
    id: number,
    coachId: number,
    coachNotes?: string,
    studentNotes?: string,
  ) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException("预约不存在");
    if (a.coachId !== coachId) throw new ForbiddenException();
    if (a.status !== AppointmentStatus.confirmed)
      throw new BadRequestException("仅能完成已确认的预约");
    a.status = AppointmentStatus.completed;
    a.coachNotes = coachNotes ?? a.coachNotes;
    a.studentNotes = studentNotes ?? a.studentNotes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (appointment) {
      const conv = await this.messages.getOrCreateConversation(
        appointment.student.id.toString(),
        appointment.student.name,
        appointment.coach.id.toString(),
        appointment.coach.name,
      );
      await this.messages.sendMessage({
        conversationId: conv.id,
        senderId: appointment.coach.id,
        senderName: appointment.coach.name,
        receiverId: appointment.student.id,
        receiverName: appointment.student.name,
        content: `课程已完成，教练备注：${coachNotes ?? ""}`,
      });
    }
    return saved;
  }

  async reschedule(
    id: number,
    coachId: number,
    startTime: Date,
    endTime: Date,
    notes?: string,
  ) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException("预约不存在");
    if (a.coachId !== coachId) throw new ForbiddenException();
    await this._validateRules(startTime, endTime);
    await this._ensureNoConflict(a.coachId, startTime, endTime, id);
    a.startTime = startTime;
    a.endTime = endTime;
    a.notes = notes ?? a.notes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (appointment) {
      const conv = await this.messages.getOrCreateConversation(
        appointment.student.id,
        appointment.student.name,
        appointment.coach.id,
        appointment.coach.name,
      );
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

  async updateNotes(
    id: number,
    user: {
      sub: number;
      role?: string;
      isManager?: boolean;
      schoolId?: number | null;
    },
    notes: string,
  ) {
    const a = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (!a) throw new NotFoundException("预约不存在");

    const userId = user.sub;
    const isStudent = a.studentId === userId;
    const isCoach = a.coachId === userId;
    const isManagerSameSchool =
      Boolean(user.isManager) &&
      user.schoolId != null &&
      !!(
        (a.student?.schoolId && a.student.schoolId === user.schoolId) ||
        (a.coach?.schoolId && a.coach.schoolId === user.schoolId)
      );

    if (!isStudent && !isCoach && !isManagerSameSchool) {
      throw new ForbiddenException("无权更新备注");
    }
    if (a.status === AppointmentStatus.completed)
      throw new BadRequestException("已完成不可修改备注");
    a.notes = notes;
    return this.repo.save(a);
  }

  async listComments(appointmentId: number, userId: number) {
    const a = await this.repo.findOne({ where: { id: appointmentId } });
    if (!a) throw new NotFoundException("预约不存在");
    if (a.studentId !== userId && a.coachId !== userId)
      throw new ForbiddenException();
    return this.commentRepo.find({
      where: { appointmentId },
      order: { createdAt: "DESC" } as any,
    });
  }

  async addComment(appointmentId: number, userId: number, content: string) {
    const a = await this.repo.findOne({
      where: { id: appointmentId },
      relations: ["student", "coach"],
    });
    if (!a) throw new NotFoundException("预约不存在");
    if (a.studentId !== userId && a.coachId !== userId)
      throw new ForbiddenException();
    const role: "student" | "coach" =
      a.studentId === userId ? "student" : "coach";
    const userName = role === "student" ? a.student.name : a.coach.name;
    const c = this.commentRepo.create({
      appointmentId,
      userId,
      userName,
      role,
      content,
    });
    return this.commentRepo.save(c);
  }

  async slots(coachIdInput: string, date: Date, currentUserId: number) {
    // 解析教练ID：支持 'auto' 或 具体ID
    let coachId: number | undefined;
    if (
      !coachIdInput ||
      coachIdInput === "auto" ||
      coachIdInput === "school_admin"
    ) {
      const coach = await this.users.getCoachForStudent(currentUserId);
      if (coach) coachId = coach.id;
    } else {
      coachId = +coachIdInput;
    }
    if (!coachId) throw new BadRequestException("未找到可用教练");

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // 当日预约
    const dayApps = await this.repo.find({
      where: {
        coachId,
        startTime: Between(start, end),
        status: MoreThanOrEqual("pending") as any,
      },
      order: { startTime: "ASC" },
    });
    // 个人不可用时间（教练）
    const availAll = await this.availabilityRepo.find({
      where: { userId: coachId },
    });

    const slots: {
      startTime: string;
      endTime: string;
      isAvailable: boolean;
      reason?: string;
    }[] = [];
    for (let h = 9; h < 18; h++) {
      for (let m = 0; m < 60; m += 30) {
        const s = new Date(date);
        s.setHours(h, m, 0, 0);
        const e = new Date(s.getTime() + 30 * 60000);
        const expired = s.getTime() < Date.now();
        const conflictApp = dayApps.some(
          (a) =>
            s < a.endTime &&
            e > a.startTime &&
            a.status !== AppointmentStatus.cancelled &&
            a.status !== AppointmentStatus.rejected,
        );
        // 匹配个人不可用
        const conflictUnavail = availAll.some((u) => {
          if (!u.isUnavailable) return false;
          if (u.repeat === "always") {
            const us = new Date(s);
            us.setHours(u.startTime.getHours(), u.startTime.getMinutes(), 0, 0);
            const ue = new Date(s);
            ue.setHours(u.endTime.getHours(), u.endTime.getMinutes(), 0, 0);
            return s < ue && e > us;
          } else {
            const sameDay =
              u.startTime.getFullYear() === s.getFullYear() &&
              u.startTime.getMonth() === s.getMonth() &&
              u.startTime.getDate() === s.getDate();
            return sameDay && s < u.endTime && e > u.startTime;
          }
        });
        const reason = conflictApp
          ? "已被预约"
          : conflictUnavail
            ? "个人不可用"
            : expired
              ? "时间已过"
              : undefined;
        slots.push({
          startTime: s.toISOString(),
          endTime: e.toISOString(),
          isAvailable: !expired && !conflictApp && !conflictUnavail,
          reason,
        });
      }
    }
    return slots;
  }

  async stats(userId: number, role: "student" | "coach") {
    const list = await this.listForUser(userId, role);
    const total = list.length;
    const confirmed = list.filter(
      (a) => a.status === AppointmentStatus.confirmed,
    ).length;
    const completed = list.filter(
      (a) => a.status === AppointmentStatus.completed,
    ).length;
    const pending = list.filter(
      (a) => a.status === AppointmentStatus.pending,
    ).length;
    const cancelled = list.filter(
      (a) => a.status === AppointmentStatus.cancelled,
    ).length;
    const now = new Date();
    const thisMonth = list.filter(
      (a) =>
        a.startTime.getFullYear() === now.getFullYear() &&
        a.startTime.getMonth() === now.getMonth(),
    ).length;
    return { total, confirmed, completed, pending, cancelled, thisMonth };
  }

  private async _ensureNoConflict(
    coachId: number,
    startTime: Date,
    endTime: Date,
    ignoreId?: number,
  ) {
    const qb = this.repo
      .createQueryBuilder("a")
      .where("a.coachId = :coachId", { coachId })
      .andWhere("(a.status IN (:...st))", {
        st: [AppointmentStatus.pending, AppointmentStatus.confirmed],
      })
      .andWhere("a.startTime < :endTime AND a.endTime > :startTime", {
        startTime,
        endTime,
      });
    if (ignoreId) qb.andWhere("a.id <> :ignoreId", { ignoreId });
    const exists = await qb.getOne();
    if (exists) {
      // 使用欧美风格的时间格式
      const format = (d: Date) => {
        const month = d.toLocaleString('en-US', { month: 'short' });
        const day = d.getDate();
        const year = d.getFullYear();
        const time = d.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return `${month} ${day}, ${year} at ${time}`;
      };
      throw new BadRequestException(
        `Time conflict with existing booking: ${format(exists.startTime)} - ${format(exists.endTime)}`,
      );
    }
  }

  private async _validateRules(
    startTime: Date,
    endTime: Date,
    options?: { skipMaxDaysCheck?: boolean }
  ) {
    const now = new Date();
    if (startTime.getTime() < now.getTime())
      throw new BadRequestException("Cannot book appointments in the past");

    // 只在非重复预约时检查30天限制
    if (!options?.skipMaxDaysCheck) {
      const max = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (startTime.getTime() > max.getTime())
        throw new BadRequestException("Bookings can only be made up to 30 days in advance");
    }

    if (endTime.getTime() <= startTime.getTime())
      throw new BadRequestException("End time must be after start time");

    const dur = endTime.getTime() - startTime.getTime();
    if (dur < 30 * 60 * 1000)
      throw new BadRequestException("Minimum booking duration is 30 minutes");
    if (dur > 3 * 60 * 60 * 1000)
      throw new BadRequestException("Maximum booking duration is 3 hours");
  }
}
