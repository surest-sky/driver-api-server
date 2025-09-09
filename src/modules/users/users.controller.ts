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

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@Req() req: any) {
    const user = await this.users.findById(req.user.sub);
    return user;
  }

  @Patch('me')
  async update(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const patch: any = { ...dto };
    if (dto.birthDate) patch.birthDate = new Date(dto.birthDate);
    const updated = await this.users.updateUser(req.user.sub, patch);
    return updated;
  }

  @Get('students')
  @UseGuards(RolesGuard)
  @Roles('coach')
  async students(
    @Req() req: any,
    @Query('schoolId') schoolId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const { items, total } = await this.users.listStudentsBySchool(+schoolId, p, ps, q);
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
}
