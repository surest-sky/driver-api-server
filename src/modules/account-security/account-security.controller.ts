import { Body, Controller, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AccountSecurityService } from './account-security.service';

class SendCodeDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;
}

class UpdateEmailDto {
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  code!: string;
}

class UpdatePasswordDto {
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('account-security')
export class AccountSecurityController {
  constructor(private readonly service: AccountSecurityService) {}

  @Post('email/send-code')
  async sendEmailCode(@Req() req: any, @Body() dto: SendCodeDto) {
    await this.service.sendEmailCode(req.user.sub, dto.email);
    return { success: true };
  }

  @Patch('email')
  async updateEmail(@Req() req: any, @Body() dto: UpdateEmailDto) {
    const user = await this.service.updateEmail(req.user.sub, dto.email, dto.code);
    return this.sanitize(user);
  }

  @Patch('password')
  async updatePassword(@Req() req: any, @Body() dto: UpdatePasswordDto) {
    await this.service.updatePassword(req.user.sub, dto.password);
    return { success: true };
  }

  private sanitize(user: any) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
