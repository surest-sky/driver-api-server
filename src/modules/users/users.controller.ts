import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { IsEmail, IsNotEmpty } from 'class-validator';

class UpdateProfileDto {
  email?: string;
  name?: string;
  avatarUrl?: string;
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

class BindSchoolDto {
  @IsNotEmpty()
  drivingSchoolCode!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@Req() req: any) {
    const user = await this.users.findById(req.user.sub);

    // 确保返回的日期格式正确
    const response: any = { ...user };
    if (response.birthDate) {
      response.birthDate = response.birthDate.toISOString().split('T')[0];
    }

    return response;
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

    // 确保返回的日期格式正确
    const response: any = { ...updated };
    if (response.birthDate) {
      response.birthDate = response.birthDate.toISOString().split('T')[0];
    }

    return response;
  }

  @Post('me/bind-school')
  async bindSchool(@Req() req: any, @Body() dto: BindSchoolDto) {
    const updated = await this.users.bindSchoolToUser(req.user.sub, dto.drivingSchoolCode);
    return updated;
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
    return { items, total, page: p, pageSize: ps };
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
    return student;
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
}
