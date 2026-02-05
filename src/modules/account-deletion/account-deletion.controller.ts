import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AccountDeletionService } from './account-deletion.service';

@UseGuards(JwtAuthGuard)
@Controller('account-deletion')
export class AccountDeletionController {
  constructor(private readonly svc: AccountDeletionService) {}

  @Post('request')
  async requestDeletion(@Req() req: any) {
    return this.svc.requestDeletion(Number(req.user.sub));
  }

  @Get('status')
  async getStatus(@Req() req: any) {
    return this.svc.getStatus(Number(req.user.sub));
  }

  @Post('restore')
  async restore(@Req() req: any) {
    return this.svc.restore(Number(req.user.sub));
  }
}
