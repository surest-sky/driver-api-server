import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Roles } from "../../common/roles.decorator";
import { RolesGuard } from "../../common/roles.guard";
import { MailService } from "../mail/mail.service";
import * as bcrypt from "bcrypt";
import { User, UserRole } from "./user.entity";
import { CreditRecord } from "./credit-record.entity";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  avatarUrl?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string; // ISO date

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;
}

class CreateStudentDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  name!: string;

  @IsNotEmpty()
  schoolCode!: string;

  schoolName?: string;
  birthDate?: string; // ISO date
}

class CreateCoachDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isManager?: boolean;
}

class UpdateCoachDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isManager?: boolean;
}

class AdjustCreditsDto {
  @IsNotEmpty()
  @IsNumber({}, { message: "Credits must be a number" })
  delta!: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  description!: string;
}

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly mail: MailService,
  ) {}

  @Get("me")
  async me(@Req() req: any) {
    const user = await this.users.findById(req.user.sub);
    return this.sanitizeUser(user);
  }

  @Patch("me")
  async update(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const patch: any = { ...dto };
    if (dto.birthDate) {
      // 处理日期格式，确保正确解析
      const birthDate = new Date(dto.birthDate);
      // 验证日期是否有效
      if (isNaN(birthDate.getTime())) {
        throw new Error("Invalid birthDate format");
      }
      // 设置为UTC时间中午，避免时区问题
      birthDate.setUTCHours(12, 0, 0, 0);
      patch.birthDate = birthDate;
    }
    const updated = await this.users.updateUser(req.user.sub, patch);
    return this.sanitizeUser(updated);
  }

  @Get("coaches")
  @UseGuards(RolesGuard)
  @Roles("coach", "student")
  async listCoaches(
    @Req() req: any,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("q") q?: string,
  ) {
    const requester = await this.users.findById(req.user.sub);
    if (!requester?.schoolId) {
      throw new BadRequestException("User has no school bound");
    }
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const { items, total } = await this.users.listCoachesBySchool(
      requester.schoolId,
      p,
      ps,
      q,
    );
    return {
      items: items.map((coach) => this.sanitizeUser(coach)),
      total,
      page: p,
      pageSize: ps,
      canManage: Boolean(requester.isManager),
    };
  }

  @Get("coaches/options")
  async coachOptions(@Req() req: any) {
    const requester = await this.users.findById(req.user.sub);
    if (!requester?.schoolId) {
      throw new BadRequestException("User has no school bound");
    }
    const { items } = await this.users.listCoachesBySchool(
      requester.schoolId,
      1,
      200,
    );
    return items.map((coach) => this.sanitizeUser(coach));
  }

  @Post("coaches")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async createCoach(@Req() req: any, @Body() dto: CreateCoachDto) {
    const requester = await this.users.findById(req.user.sub);
    if (!requester?.schoolId) {
      throw new BadRequestException("User has no school bound");
    }
    if (!requester.isManager) {
      throw new ForbiddenException("Only managers can add coaches");
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new BadRequestException("Email already exists");
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const name = dto.name?.trim() || email.split("@")[0];
    const coach = await this.users.createUser({
      email,
      name,
      passwordHash,
      role: UserRole.coach,
      schoolId: requester.schoolId,
      isManager: false,
    });
    let result = await this.users.findCoachById(coach.id);
    if (dto.isManager) {
      result = await this.users.setManagerForSchool(
        requester.schoolId,
        coach.id,
      );
    }
    // TODO: 发送欢迎邮件给新教练，包含账号密码和学校信息
    return this.sanitizeUser(result);
  }

  @Patch("coaches/:id")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async updateCoach(
    @Req() req: any,
    @Param("id", ParseIntPipe) coachId: number,
    @Body() dto: UpdateCoachDto,
  ) {
    const requester = await this.users.findById(req.user.sub);
    if (!requester?.schoolId) {
      throw new BadRequestException("User has no school bound");
    }
    if (!requester.isManager) {
      throw new ForbiddenException("Only managers can modify coaches");
    }
    const coach = await this.users.findCoachById(coachId);
    if (!coach || coach.schoolId !== requester.schoolId) {
      throw new BadRequestException("Coach not found");
    }

    const patch: Partial<User> = {};
    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (normalizedEmail !== coach.email) {
        const existing = await this.users.findByEmail(normalizedEmail);
        if (existing && existing.id !== coach.id) {
          throw new BadRequestException("Email already in use");
        }
        patch.email = normalizedEmail;
      }
    }
    if (dto.password) {
      patch.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.name) {
      patch.name = dto.name.trim();
    }
    if (
      dto.isManager === false &&
      coach.isManager &&
      coach.id === requester.id
    ) {
      throw new BadRequestException("Please assign another manager before removing your own admin privileges");
    }
    if (dto.isManager === false) {
      patch.isManager = false;
    }

    let updated = await this.users.updateCoach(coachId, patch);

    if (dto.isManager) {
      updated = await this.users.setManagerForSchool(
        requester.schoolId,
        coachId,
      );
    }

    return this.sanitizeUser(updated);
  }

  @Get("students")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async students(
    @Req() req: any,
    @Query("school_id") schoolId: string,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "20",
    @Query("q") q?: string,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const schoolIdNum = Number(schoolId);
    if (!schoolIdNum || isNaN(schoolIdNum)) {
      throw new Error("Invalid school_id parameter");
    }
    const { items, total } = await this.users.listStudentsBySchool(
      schoolIdNum,
      p,
      ps,
      q,
    );
    return {
      items: items.map((item) => this.sanitizeUser(item)),
      total,
      page: p,
      pageSize: ps,
    };
  }

  @Post("students")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async createStudent(@Req() req: any, @Body() dto: CreateStudentDto) {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      throw new BadRequestException("当前用户未绑定学校");
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      if (existing.role !== UserRole.student) {
        throw new BadRequestException("Email already in use");
      }
      if (existing.schoolId === schoolId) {
        throw new BadRequestException("This student is already yours");
      }
      throw new BadRequestException("This student is bound to another school");
    }

    const school = await this.users.findSchoolById(schoolId);
    if (!school) {
      throw new BadRequestException("School not found");
    }

    // 创建学生用户
    const userData: any = {
      email,
      name: dto.name?.trim() || email.split("@")[0],
      role: "student",
      schoolId,
      passwordHash: null, // 将使用默认密码 123456
    };

    if (dto.birthDate) {
      userData.birthDate = new Date(dto.birthDate);
    }

    const student = await this.users.createUser(userData);
    await this.sendStudentInviteEmail(email, school.name);
    return this.sanitizeUser(student);
  }

  @Post("students/:id/invite")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async resendInvite(@Req() req: any, @Param("id", ParseIntPipe) studentId: number) {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      throw new BadRequestException("当前用户未绑定学校");
    }
    const student = await this.users.findById(studentId);
    if (!student || student.role !== UserRole.student) {
      throw new BadRequestException("Student not found");
    }
    if (student.schoolId !== schoolId) {
      throw new BadRequestException("Student does not belong to current school");
    }
    const school = await this.users.findSchoolById(schoolId);
    if (!school) {
      throw new BadRequestException("School not found");
    }
    await this.sendStudentInviteEmail(student.email, school.name);
    return { ok: true };
  }

  @Post("students/:id/unbind")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async unbindStudent(@Req() req: any, @Param("id", ParseIntPipe) studentId: number) {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      throw new BadRequestException("当前用户未绑定学校");
    }
    const result = await this.users.unbindStudentFromSchool(studentId, schoolId);
    return this.sanitizeUser(result);
  }

  @Get("dashboard")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async getDashboard(@Req() req: any) {
    const schoolId = req.user.schoolId;
    const coachId = req.user.sub;

    // 获取学员总数
    const { total: totalStudents } = await this.users.listStudentsBySchool(
      schoolId,
      1,
      1000,
    );

    // 获取今日活跃学员数(简化版，实际应该从学习记录中统计)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeStudentsToday = Math.floor(totalStudents * 0.3); // 模拟30%活跃率

    // 获取本周新增学员(简化版)
    const newStudentsThisWeek = Math.floor(totalStudents * 0.05); // 模拟5%增长率

    // 模拟其他统计数据
    const completionRate = 75.5; // 完成率75.5%
    const averageStudyTime = 45; // 平均学习时长45分钟

    return {
      totalStudents,
      activeStudentsToday,
      newStudentsThisWeek,
      completionRate,
      averageStudyTime,
      trends: {
        students: [
          { date: "2025-01-05", count: totalStudents - 6 },
          { date: "2025-01-06", count: totalStudents - 5 },
          { date: "2025-01-07", count: totalStudents - 3 },
          { date: "2025-01-08", count: totalStudents - 2 },
          { date: "2025-01-09", count: totalStudents - 1 },
          { date: "2025-01-10", count: totalStudents },
          { date: "2025-01-11", count: totalStudents + 1 },
        ],
        activity: [
          { date: "2025-01-05", active: Math.floor(activeStudentsToday * 0.8) },
          { date: "2025-01-06", active: Math.floor(activeStudentsToday * 0.9) },
          { date: "2025-01-07", active: Math.floor(activeStudentsToday * 1.1) },
          { date: "2025-01-08", active: Math.floor(activeStudentsToday * 0.7) },
          { date: "2025-01-09", active: Math.floor(activeStudentsToday * 1.2) },
          { date: "2025-01-10", active: activeStudentsToday },
          { date: "2025-01-11", active: Math.floor(activeStudentsToday * 1.1) },
        ],
      },
    };
  }

  @Get("stats")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async getStats(@Req() req: any, @Query("period") period = "week") {
    const schoolId = req.user.schoolId;

    // 获取基础统计数据
    const { total: totalStudents } = await this.users.listStudentsBySchool(
      schoolId,
      1,
      1000,
    );

    // 模拟不同时间周期的数据
    let periodData;
    switch (period) {
      case "day":
        periodData = {
          activeStudents: Math.floor(totalStudents * 0.25),
          newRegistrations: Math.floor(totalStudents * 0.01),
          completionRate: 72.3,
          studyTime: 38,
        };
        break;
      case "month":
        periodData = {
          activeStudents: Math.floor(totalStudents * 0.85),
          newRegistrations: Math.floor(totalStudents * 0.15),
          completionRate: 78.2,
          studyTime: 52,
        };
        break;
      default: // week
        periodData = {
          activeStudents: Math.floor(totalStudents * 0.65),
          newRegistrations: Math.floor(totalStudents * 0.05),
          completionRate: 75.5,
          studyTime: 45,
        };
    }

    return {
      period,
      totalStudents,
      ...periodData,
      lastUpdated: new Date().toISOString(),
    };
  }

  // 积分相关路由
  @Get("students/:id/credits")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async getStudentCredits(@Req() req: any, @Param("id", ParseIntPipe) studentId: number) {
    const schoolId = req.user.schoolId;
    const student = await this.users.findById(studentId);
    if (!student || student.role !== UserRole.student) {
      throw new BadRequestException("Student not found");
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException("No permission to access student information");
    }
    return { credits: student.credits || 0 };
  }

  @Get("students/:id/credit-records")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async getStudentCreditRecords(
    @Req() req: any,
    @Param("id", ParseIntPipe) studentId: number,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "50",
  ) {
    const schoolId = req.user.schoolId;
    const student = await this.users.findById(studentId);
    if (!student || student.role !== UserRole.student) {
      throw new BadRequestException("Student not found");
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException("No permission to access student information");
    }
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 50));
    const { items, total } = await this.users.getCreditRecords(studentId, p, ps);
    return { items, total, page: p, pageSize: ps };
  }

  @Post("students/:id/credits")
  @UseGuards(RolesGuard)
  @Roles("coach")
  async adjustStudentCredits(
    @Req() req: any,
    @Param("id", ParseIntPipe) studentId: number,
    @Body() dto: AdjustCreditsDto,
  ) {
    const schoolId = req.user.schoolId;
    const coachId = req.user.sub;
    const student = await this.users.findById(studentId);
    if (!student || student.role !== UserRole.student) {
      throw new BadRequestException("Student not found");
    }
    if (student.schoolId !== schoolId) {
      throw new ForbiddenException("No permission to modify student credits");
    }
    const record = await this.users.adjustCredits(
      studentId,
      coachId,
      dto.delta,
      dto.description,
    );
    return { record };
  }

  private sanitizeUser(user: User | null) {
    if (!user) return null;
    const { passwordHash, ...rest } = user as any;
    rest.hasPassword = Boolean(passwordHash);
    if (rest.birthDate instanceof Date) {
      rest.birthDate = rest.birthDate.toISOString().split("T")[0];
    }
    if (rest.createdAt instanceof Date) {
      rest.createdAt = rest.createdAt.toISOString();
    }
    if (rest.updatedAt instanceof Date) {
      rest.updatedAt = rest.updatedAt.toISOString();
    }
    if (rest.school) {
      rest.school = { ...rest.school };
      if (rest.school.createdAt instanceof Date) {
        rest.school.createdAt = rest.school.createdAt.toISOString();
      }
      if (rest.school.updatedAt instanceof Date) {
        rest.school.updatedAt = rest.school.updatedAt.toISOString();
      }
    }
    return rest;
  }

  private async sendStudentInviteEmail(email: string, schoolName: string) {
    const context = {
      schoolName,
      email,
      password: '123456',
    };
    const defaultSubject = `You're invited to join ${schoolName}`;
    const defaultText = [
      `Hello, you've been added as a student at ${schoolName}.`,
      `Login email: ${email}`,
      `Temporary password: ${context.password}`,
      'Please log in and change your password as soon as possible.',
    ].join('\n');
    const defaultHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Student Invitation</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0d1c2e;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
            <tr>
              <td style="text-align:center;">
                <div style="display:inline-block;padding:10px 18px;border-radius:999px;background:linear-gradient(135deg,#10b981,#22d3ee);color:#ffffff;font-weight:600;letter-spacing:0.6px;">
                  Student Invitation
                </div>
                <h2 style="margin:22px 0 10px;font-size:24px;color:#0d1c2e;">
                  Welcome to {schoolName}
                </h2>
                <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                  You've been added as a student. Use the details below to sign in.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
                <p style="margin:0 0 12px;font-size:14px;color:#64748b;">Login email</p>
                <p style="margin:0 0 18px;font-size:16px;font-weight:600;color:#0f172a;">{email}</p>
                <p style="margin:0 0 12px;font-size:14px;color:#64748b;">Temporary password</p>
                <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:2px;color:#0f172a;">{password}</p>
              </td>
            </tr>
            <tr>
              <td style="padding-top:22px;text-align:center;">
                <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">
                  Please log in and update your password as soon as possible.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin-top:24px;font-size:12px;color:#94a3b8;">
            This email was sent automatically. Please do not reply.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const subject = this.applyTemplate(
      process.env.STUDENT_INVITE_SUBJECT || defaultSubject,
      context,
    );
    const text = this.applyTemplate(
      process.env.STUDENT_INVITE_BODY || defaultText,
      context,
    );
    const html = this.applyTemplate(
      process.env.STUDENT_INVITE_HTML || defaultHtml,
      context,
    );

    await this.mail.sendMail({ to: email, subject, text, html });
  }

  private applyTemplate(
    template: string,
    vars: Record<string, string>,
  ): string {
    return Object.entries(vars).reduce(
      (acc, [key, value]) =>
        acc.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
      template,
    );
  }
}
