import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { InvitesService } from './invites.service';

class InviteCodeDto {
  code!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('invites')
export class InvitesController {
  constructor(private readonly svc: InvitesService) {}

  @Get('status')
  status(@Req() req: any, @Query('studentId') studentId: string) {
    return this.svc.getStatus(req.user.sub, studentId);
  }

  @Get()
  list(@Req() req: any) {
    return this.svc.listForCoach(req.user.sub);
  }

  @Post()
  invite(@Req() req: any, @Query('studentId') studentId: string) {
    return this.svc.invite(req.user.sub, studentId);
  }

  @Post('resolve')
  resolve(@Req() req: any, @Body() dto: InviteCodeDto) {
    return this.svc.resolveForUser(req.user.sub, dto.code);
  }

  @Post('accept')
  accept(@Req() req: any, @Body() dto: InviteCodeDto) {
    return this.svc.acceptForUser(req.user.sub, dto.code);
  }
}
