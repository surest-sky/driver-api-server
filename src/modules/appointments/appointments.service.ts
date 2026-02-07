import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Between, DataSource, EntityManager, MoreThanOrEqual, Repository } from "typeorm";
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
} from "./appointment.entity";
import { AppointmentCommentEntity } from "./appointment-comment.entity";
import { UsersService } from "../users/users.service";
import { Availability } from "../availability/availability.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { ChatService, AppointmentMessageType } from "../messages/chat.service";
import { User } from "../users/user.entity";
import { CreditRecord } from "../users/credit-record.entity";

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
    @InjectRepository(AppointmentCommentEntity)
    private readonly commentRepo: Repository<AppointmentCommentEntity>,
    private readonly users: UsersService,
    private readonly chat: ChatService,
    @InjectRepository(Availability)
    private readonly availabilityRepo: Repository<Availability>,
    private readonly dataSource: DataSource,
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
    if (!a) throw new NotFoundException("Appointment not found");
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
    if (!student) throw new BadRequestException("Student not found");

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
        throw new BadRequestException("No available coach found");
      }
    } else {
      coach = await this.users.findById(data.coachId as number);
      if (!coach) throw new BadRequestException("Coach not found");
    }

    await this._ensureUserAvailability(
      student.id,
      data.startTime,
      data.endTime,
      "student",
    );
    await this._ensureUserAvailability(
      coach.id,
      data.startTime,
      data.endTime,
      "coach",
    );

    await this._ensureNoConflict(coach.id, data.startTime, data.endTime);

    const requiredCredits = this._calculateCredits(
      data.startTime,
      data.endTime,
    );

    // 根据发起者设置初始状态
    const initialStatus = data.initiator === "coach"
        ? AppointmentStatus.confirmed
        : AppointmentStatus.pending;

    const saved = await this.dataSource.transaction(async (manager) => {
      const appointmentRepo = manager.getRepository(Appointment);
      const studentRepo = manager.getRepository(User);
      const creditRepo = manager.getRepository(CreditRecord);

      const lockedStudent = await studentRepo.findOne({
        where: { id: student.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedStudent) throw new BadRequestException("Student not found");

      const newBalance = this._roundCredits(
        Number(lockedStudent.credits || 0) - requiredCredits,
      );
      if (newBalance < 0) {
        throw new BadRequestException("Insufficient credits");
      }

      const appointment = appointmentRepo.create({
        studentId: student.id,
        coachId: coach.id,
        startTime: data.startTime,
        endTime: data.endTime,
        type: data.type ?? AppointmentType.regular,
        notes: data.notes ?? null,
        location: data.location ?? null,
        status: initialStatus,
      });
      const created = await appointmentRepo.save(appointment);

      if (requiredCredits > 0) {
        const record = creditRepo.create({
          studentId: student.id,
          coachId: coach.id,
          delta: this._roundCredits(-requiredCredits),
          description: this._creditUsageDescription(
            "Appointment credit deduction",
            data.startTime,
            data.endTime,
            created.id,
          ),
          balanceAfter: newBalance,
          createdAt: new Date(),
        });
        await creditRepo.save(record);
        await studentRepo.update({ id: student.id }, { credits: newBalance });
      }

      return created;
    });

    console.log('[Appointments] Appointment created:', { id: saved.id, initiator: data.initiator, status: initialStatus });

    // 如果是教练发起且已确认，通知学员（而不是教练）
    if (data.initiator === "coach" && initialStatus === AppointmentStatus.confirmed) {
      console.log('[Appointments] Sending message to student...');
      try {
        await this.chat.sendAppointmentMessage({
          coachId: coach.id,
          studentId: student.id,
          appointmentId: saved.id,
          coachName: coach.name,
          studentName: student.name,
          type: AppointmentMessageType.created,
          startTime: saved.startTime,
          endTime: saved.endTime,
          initiator: 'coach',
        });
        console.log('[Appointments] Message sent successfully');
      } catch (e) {
        console.warn("appointments.create: notify student failed", e);
      }
    } else {
      console.log('[Appointments] Not sending message (conditions not met):', { initiator: data.initiator, status: initialStatus });
      // 学员发起，通知教练
      try {
        await this.chat.sendAppointmentMessage({
          coachId: coach.id,
          studentId: student.id,
          appointmentId: saved.id,
          coachName: coach.name,
          studentName: student.name,
          type: AppointmentMessageType.created,
          startTime: saved.startTime,
          endTime: saved.endTime,
          initiator: 'student',
        });
      } catch (e) {
        console.warn("appointments.create: notify coach failed", e);
      }
    }
    return saved;
  }

  async confirm(id: number, coachId: number, coachNotes?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException("Appointment not found");
    if (a.coachId !== coachId) throw new ForbiddenException();

    // 调试日志：检查状态值
    console.log(`[confirm] Appointment ${id} status: "${a.status}", type: ${typeof a.status}, enum pending: "${AppointmentStatus.pending}"`);
    console.log(`[confirm] Status comparison:`, {
      actual: a.status,
      expected: AppointmentStatus.pending,
      isEqual: a.status === AppointmentStatus.pending,
      stringEqual: String(a.status) === String(AppointmentStatus.pending),
    });

    if (a.status !== AppointmentStatus.pending)
      throw new BadRequestException("Only pending appointments can be confirmed");
    await this._ensureUserAvailability(
      a.studentId,
      a.startTime,
      a.endTime,
      "student",
    );
    await this._ensureUserAvailability(
      a.coachId,
      a.startTime,
      a.endTime,
      "coach",
    );
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
      try {
        await this.chat.sendAppointmentMessage({
          coachId: appointment.coach.id,
          studentId: appointment.student.id,
          appointmentId: appointment.id,
          coachName: appointment.coach.name,
          studentName: appointment.student.name,
          type: AppointmentMessageType.confirmed,
          startTime: a.startTime,
          endTime: a.endTime,
        });
      } catch (e) {
        console.warn("appointments.confirm: notify student failed", e);
      }
    }
    return saved;
  }

  async reject(id: number, coachId: number, reason?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException("Appointment not found");
    if (a.coachId !== coachId) throw new ForbiddenException();
    if (a.status !== AppointmentStatus.pending)
      throw new BadRequestException("Only pending appointments can be rejected");
    const saved = await this.dataSource.transaction(async (manager) => {
      const appointmentRepo = manager.getRepository(Appointment);
      const appointment = await appointmentRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!appointment) throw new NotFoundException("Appointment not found");
      if (appointment.status !== AppointmentStatus.pending) {
        throw new BadRequestException("Only pending appointments can be rejected");
      }
      appointment.status = AppointmentStatus.rejected;
      appointment.coachNotes = reason ?? appointment.coachNotes;
      const updated = await appointmentRepo.save(appointment);
      await this._refundCredits(
        manager,
        updated,
        "Refund for rejected appointment",
      );
      return updated;
    });
    const appointment = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (appointment) {
      try {
        await this.chat.sendAppointmentMessage({
          coachId: appointment.coach.id,
          studentId: appointment.student.id,
          appointmentId: appointment.id,
          coachName: appointment.coach.name,
          studentName: appointment.student.name,
          type: AppointmentMessageType.rejected,
          startTime: a.startTime,
          endTime: a.endTime,
          reason: reason,
          initiator: 'coach',
        });
      } catch (e) {
        console.warn("appointments.reject: notify student failed", e);
      }
    }
    return saved;
  }

  async cancel(id: number, userId: number, notes?: string) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException("Appointment not found");
    if (a.studentId !== userId && a.coachId !== userId)
      throw new ForbiddenException();
    if (a.status === AppointmentStatus.completed)
      throw new BadRequestException("Completed appointments cannot be canceled");
    if (
      a.status === AppointmentStatus.cancelled ||
      a.status === AppointmentStatus.rejected
    ) {
      throw new BadRequestException("Appointment already canceled");
    }
    // 仅对学员保留2小时限制，教练可以随时取消
    if (a.studentId === userId && a.startTime.getTime() - Date.now() < 2 * 60 * 60 * 1000) {
      throw new BadRequestException("Cannot cancel within 2 hours of start time");
    }
    const saved = await this.dataSource.transaction(async (manager) => {
      const appointmentRepo = manager.getRepository(Appointment);
      const appointment = await appointmentRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!appointment) throw new NotFoundException("Appointment not found");
      if (
        appointment.status === AppointmentStatus.cancelled ||
        appointment.status === AppointmentStatus.rejected
      ) {
        throw new BadRequestException("Appointment already canceled");
      }
      if (appointment.status === AppointmentStatus.completed) {
        throw new BadRequestException("Completed appointments cannot be canceled");
      }
      appointment.status = AppointmentStatus.cancelled;
      appointment.notes = notes ?? appointment.notes;
      const updated = await appointmentRepo.save(appointment);
      await this._refundCredits(
        manager,
        updated,
        "Refund for canceled appointment",
      );
      return updated;
    });
    const appointment = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (appointment) {
      const initiator = userId === a.studentId ? 'student' : 'coach';
      try {
        await this.chat.sendAppointmentMessage({
          coachId: appointment.coach.id,
          studentId: appointment.student.id,
          appointmentId: appointment.id,
          coachName: appointment.coach.name,
          studentName: appointment.student.name,
          type: AppointmentMessageType.cancelled,
          startTime: a.startTime,
          endTime: a.endTime,
          initiator: initiator,
        });
      } catch (e) {
        console.warn("appointments.cancel: notify failed", e);
      }
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
    if (!a) throw new NotFoundException("Appointment not found");
    if (a.coachId !== coachId) throw new ForbiddenException();
    if (a.status !== AppointmentStatus.confirmed)
      throw new BadRequestException("Only confirmed appointments can be completed");
    a.status = AppointmentStatus.completed;
    a.coachNotes = coachNotes ?? a.coachNotes;
    a.studentNotes = studentNotes ?? a.studentNotes;
    const saved = await this.repo.save(a);
    const appointment = await this.repo.findOne({
      where: { id },
      relations: ["student", "coach"],
    });
    if (appointment) {
      try {
        await this.chat.sendAppointmentMessage({
          coachId: appointment.coach.id,
          studentId: appointment.student.id,
          appointmentId: appointment.id,
          coachName: appointment.coach.name,
          studentName: appointment.student.name,
          type: AppointmentMessageType.completed,
          startTime: a.startTime,
          endTime: a.endTime,
          initiator: 'coach',
        });
      } catch (e) {
        console.warn("appointments.complete: notify student failed", e);
      }
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
    if (!a) throw new NotFoundException("Appointment not found");
    if (a.coachId !== coachId) throw new ForbiddenException();
    await this._validateRules(startTime, endTime);
    await this._ensureUserAvailability(
      a.studentId,
      startTime,
      endTime,
      "student",
    );
    await this._ensureUserAvailability(
      a.coachId,
      startTime,
      endTime,
      "coach",
    );
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
      try {
        await this.chat.sendAppointmentMessage({
          coachId: appointment.coach.id,
          studentId: appointment.student.id,
          appointmentId: appointment.id,
          coachName: appointment.coach.name,
          studentName: appointment.student.name,
          type: AppointmentMessageType.rescheduled,
          startTime: a.startTime,
          endTime: a.endTime,
          initiator: 'coach',
        });
      } catch (e) {
        console.warn("appointments.reschedule: notify student failed", e);
      }
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
    if (!a) throw new NotFoundException("Appointment not found");

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
      throw new ForbiddenException("Not allowed to update notes");
    }
    if (a.status === AppointmentStatus.completed)
      throw new BadRequestException("Completed appointments cannot be updated");
    a.notes = notes;
    return this.repo.save(a);
  }

  async listComments(appointmentId: number, userId: number) {
    const a = await this.repo.findOne({ where: { id: appointmentId } });
    if (!a) throw new NotFoundException("Appointment not found");
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
    if (!a) throw new NotFoundException("Appointment not found");
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
    if (!coachId) throw new BadRequestException("No available coach found");

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
          ? "Booked"
          : conflictUnavail
            ? "Unavailable"
            : expired
              ? "Expired"
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

  private _roundCredits(value: number) {
    return Number(Number(value || 0).toFixed(2));
  }

  private _calculateCredits = (startTime: Date, endTime: Date) => {
    const minutes = (endTime.getTime() - startTime.getTime()) / 60000;
    return this._roundCredits(minutes / 60);
  };

  private _formatTimeLabel(date: Date) {
    const pad = (value: number) => value.toString().padStart(2, "0");
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${y}-${m}-${d} ${h}:${min}`;
  }

  private _creditUsageDescription(
    prefix: string,
    startTime: Date,
    endTime: Date,
    appointmentId?: number,
  ) {
    const start = this._formatTimeLabel(startTime);
    const end = this._formatTimeLabel(endTime);
    const suffix = appointmentId ? ` #${appointmentId}` : "";
    return `${prefix}（${start} - ${end}）${suffix}`;
  }

  private async _refundCredits(
    manager: EntityManager,
    appointment: Appointment,
    prefix: string,
  ) {
    const refundCredits = this._calculateCredits(
      appointment.startTime,
      appointment.endTime,
    );
    if (refundCredits <= 0) return;

    const studentRepo = manager.getRepository(User);
    const creditRepo = manager.getRepository(CreditRecord);
    const lockedStudent = await studentRepo.findOne({
      where: { id: appointment.studentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!lockedStudent) return;

    const newBalance = this._roundCredits(
      Number(lockedStudent.credits || 0) + refundCredits,
    );
    const record = creditRepo.create({
      studentId: appointment.studentId,
      coachId: appointment.coachId,
      delta: this._roundCredits(refundCredits),
      description: this._creditUsageDescription(
        prefix,
        appointment.startTime,
        appointment.endTime,
        appointment.id,
      ),
      balanceAfter: newBalance,
      createdAt: new Date(),
    });
    await creditRepo.save(record);
    await studentRepo.update(
      { id: appointment.studentId },
      { credits: newBalance },
    );
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

  private _formatShortTimeLabel(date: Date) {
    const month = date.toLocaleString("en-US", { month: "short" });
    const day = date.getDate();
    const time = date.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${month} ${day}. ${time}`;
  }

  private async _ensureUserAvailability(
    userId: number,
    startTime: Date,
    endTime: Date,
    label: "student" | "coach",
  ) {
    const items = await this.availabilityRepo.find({ where: { userId } });
    if (!items.length) return;

    const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
      aStart < bEnd && aEnd > bStart;

    const dayStart = new Date(startTime);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(endTime);
    dayEnd.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (
      let d = new Date(dayStart);
      d <= dayEnd;
      d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
    ) {
      days.push(new Date(d));
    }

    for (const finalItem of items) {
      if (!finalItem.isUnavailable) continue;

      if (finalItem.repeat === "always") {
        for (const day of days) {
          const unavailStart = new Date(day);
          unavailStart.setHours(
            finalItem.startTime.getHours(),
            finalItem.startTime.getMinutes(),
            0,
            0,
          );
          const unavailEnd = new Date(day);
          unavailEnd.setHours(
            finalItem.endTime.getHours(),
            finalItem.endTime.getMinutes(),
            0,
            0,
          );
          if (unavailEnd <= unavailStart) {
            unavailEnd.setDate(unavailEnd.getDate() + 1);
          }
          if (overlaps(startTime, endTime, unavailStart, unavailEnd)) {
            const range = `${this._formatShortTimeLabel(
              unavailStart,
            )} - ${this._formatShortTimeLabel(unavailEnd)}`;
            throw new BadRequestException(
              `Time conflict with ${label} unavailable time: ${range}`,
            );
          }
        }
      } else {
        if (
          overlaps(startTime, endTime, finalItem.startTime, finalItem.endTime)
        ) {
          const range = `${this._formatShortTimeLabel(
            finalItem.startTime,
          )} - ${this._formatShortTimeLabel(finalItem.endTime)}`;
          throw new BadRequestException(
            `Time conflict with ${label} unavailable time: ${range}`,
          );
        }
      }
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
