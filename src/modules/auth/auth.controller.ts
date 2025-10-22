import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRole } from '../users/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password);
  }

  @Post('register')
  register(@Body() body: any) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException('Email and password are required');
    }
    if (!body?.firstName || !body?.lastName) {
      throw new BadRequestException('First name and last name are required');
    }

    const roleValue = typeof body?.role === 'string' ? body.role.trim().toLowerCase() : 'student';
    const role = roleValue === UserRole.coach ? UserRole.coach : UserRole.student;

    return this.auth.register({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      birthDate: body.birthDate,
      role,
      hasDrivingSchool: body.hasDrivingSchool,
      drivingSchoolCode: body.drivingSchoolCode,
      drivingSchoolName: body.drivingSchoolName,
      contactNumber: body.contactNumber,
    });
  }
}
