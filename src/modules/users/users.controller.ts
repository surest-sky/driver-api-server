import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';
import { IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@Req() req: any) {
    const user = await this.users.findById(req.user.sub);
    return this.sanitizeUser(user);
  }

  @Patch('me')
  async update(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const patch: any = { ...dto };
    if (dto.birthDate) {
      // 处理日期格式，确保正确解析
      const birthDate = new Date(dto.birthDate);
      // 验证日期是否有效
      if (isNaN(birthDate.getTime())) {
        throw new Error('Invalid birthDate format');
      }
      // 设置为UTC时间中午，避免时区问题
      birthDate.setUTCHours(12, 0, 0, 0);
      patch.birthDate = birthDate;
    }
    const updated = await this.users.updateUser(req.user.sub, patch);
    return this.sanitizeUser(updated);
  }

  @Get('coaches')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async listCoaches(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
  ) {
    const requester = await this.users.findById(req.user.sub);
    if (!requester?.schoolId) {
      throw new BadRequestException('当前用户未绑定学校');
    }
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const { items, total } = await this.users.listCoachesBySchool(requester.schoolId, p, ps, q);
    return {
      items: items.map((coach) => this.sanitizeUser(coach)),
      total,
      page: p,
      pageSize: ps,
      canManage: Boolean(requester.isManager),
    };
  }

  @Get('coaches/options')
  async coachOptions(@Req() req: any) {
    const requester = await this.users.findById(req.user.sub);
    if (!requester?.schoolId) {
      throw new BadRequestException('当前用户未绑定学校');
    }
    const { items } = await this.users.listCoachesBySchool(requester.schoolId, 1, 200);
    return items.map((coach) => this.sanitizeUser(coach));
  }

  @Post('coaches')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async createCoach(@Req() req: any, @Body() dto: CreateCoachDto) {
    const requester = await this.users.findById(req.user.sub);
    if (!requester?.schoolId) {
      throw new BadRequestException('当前用户未绑定学校');
    }
    if (!requester.isManager) {
      throw new ForbiddenException('只有管理者可以添加教练');
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new BadRequestException('邮箱已存在');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const name = dto.name?.trim() || email.split('@')[0];
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
      result = await this.users.setManagerForSchool(requester.schoolId, coach.id);
    }
    // TODO: 发送欢迎邮件给新教练，包含账号密码和学校信息
    return this.sanitizeUser(result);
  }

  @Patch('coaches/:id')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async updateCoach(@Req() req: any, @Param('id', ParseIntPipe) coachId: number, @Body() dto: UpdateCoachDto) {
    const requester = await this.users.findById(req.user.sub);
    if (!requester?.schoolId) {
      throw new BadRequestException('当前用户未绑定学校');
    }
    if (!requester.isManager) {
      throw new ForbiddenException('只有管理者可以修改教练');
    }
    const coach = await this.users.findCoachById(coachId);
    if (!coach || coach.schoolId !== requester.schoolId) {
      throw new BadRequestException('教练不存在');
    }

    const patch: Partial<User> = {};
    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (normalizedEmail !== coach.email) {
        const existing = await this.users.findByEmail(normalizedEmail);
        if (existing && existing.id !== coach.id) {
          throw new BadRequestException('邮箱已存在');
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
    if (dto.isManager === false && coach.isManager && coach.id === requester.id) {
      throw new BadRequestException('请先指定其他管理者后再取消自己的管理权限');
    }
    if (dto.isManager === false) {
      patch.isManager = false;
    }

    let updated = await this.users.updateCoach(coachId, patch);

    if (dto.isManager) {
      updated = await this.users.setManagerForSchool(requester.schoolId, coachId);
    }

    return this.sanitizeUser(updated);
  }

  @Get('students')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async students(
    @Req() req: any,
    @Query('school_id') schoolId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const schoolIdNum = Number(schoolId);
    if (!schoolIdNum || isNaN(schoolIdNum)) {
      throw new Error('Invalid school_id parameter');
    }
    const { items, total } = await this.users.listStudentsBySchool(schoolIdNum, p, ps, q);
    return { items: items.map((item) => this.sanitizeUser(item)), total, page: p, pageSize: ps };
  }

  @Post('students')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async createStudent(@Req() req: any, @Body() dto: CreateStudentDto) {
    // 检查邮箱是否已存在
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new Error('邮箱已被使用');
    }

    // 创建学生用户
    const userData: any = {
      email: dto.email,
      name: dto.name,
      role: 'student',
      schoolCode: dto.schoolCode,
      schoolName: dto.schoolName,
      passwordHash: null, // 将使用默认密码 123456
    };

    if (dto.birthDate) {
      userData.birthDate = new Date(dto.birthDate);
    }

    const student = await this.users.createUser(userData);
    return this.sanitizeUser(student);
  }

  @Get('dashboard')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getDashboard(@Req() req: any) {
    const schoolId = req.user.schoolId;
    const coachId = req.user.sub;

    // 获取学员总数
    const { total: totalStudents } = await this.users.listStudentsBySchool(schoolId, 1, 1000);

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
          { date: '2025-01-05', count: totalStudents - 6 },
          { date: '2025-01-06', count: totalStudents - 5 },
          { date: '2025-01-07', count: totalStudents - 3 },
          { date: '2025-01-08', count: totalStudents - 2 },
          { date: '2025-01-09', count: totalStudents - 1 },
          { date: '2025-01-10', count: totalStudents },
          { date: '2025-01-11', count: totalStudents + 1 },
        ],
        activity: [
          { date: '2025-01-05', active: Math.floor(activeStudentsToday * 0.8) },
          { date: '2025-01-06', active: Math.floor(activeStudentsToday * 0.9) },
          { date: '2025-01-07', active: Math.floor(activeStudentsToday * 1.1) },
          { date: '2025-01-08', active: Math.floor(activeStudentsToday * 0.7) },
          { date: '2025-01-09', active: Math.floor(activeStudentsToday * 1.2) },
          { date: '2025-01-10', active: activeStudentsToday },
          { date: '2025-01-11', active: Math.floor(activeStudentsToday * 1.1) },
        ]
      }
    };
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async getStats(
    @Req() req: any,
    @Query('period') period = 'week'
  ) {
    const schoolId = req.user.schoolId;
    
    // 获取基础统计数据
    const { total: totalStudents } = await this.users.listStudentsBySchool(schoolId, 1, 1000);
    
    // 模拟不同时间周期的数据
    let periodData;
    switch (period) {
      case 'day':
        periodData = {
          activeStudents: Math.floor(totalStudents * 0.25),
          newRegistrations: Math.floor(totalStudents * 0.01),
          completionRate: 72.3,
          studyTime: 38
        };
        break;
      case 'month':
        periodData = {
          activeStudents: Math.floor(totalStudents * 0.85),
          newRegistrations: Math.floor(totalStudents * 0.15),
          completionRate: 78.2,
          studyTime: 52
        };
        break;
      default: // week
        periodData = {
          activeStudents: Math.floor(totalStudents * 0.65),
          newRegistrations: Math.floor(totalStudents * 0.05),
          completionRate: 75.5,
          studyTime: 45
        };
    }

    return {
      period,
      totalStudents,
      ...periodData,
      lastUpdated: new Date().toISOString()
    };
  }

  private sanitizeUser(user: User | null) {
    if (!user) return null;
    const { passwordHash, ...rest } = user as any;
    if (rest.birthDate instanceof Date) {
      rest.birthDate = rest.birthDate.toISOString().split('T')[0];
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
}
