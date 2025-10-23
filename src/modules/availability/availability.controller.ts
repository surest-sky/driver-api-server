import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AvailabilityService } from './availability.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly svc: AvailabilityService,
    private readonly users: UsersService,
  ) {}

  @Get('me')
  async list(@Req() req: any) {
    const items = await this.svc.listForUser(req.user.sub);
    return items; // 返回数组
  }

  @Post()
  async create(@Req() req: any, @Body() body: { startTime: string; endTime: string; repeat: 'always'|'once'; isUnavailable?: boolean }) {
    const item = await this.svc.create(req.user.sub, {
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      repeat: body.repeat,
      isUnavailable: body.isUnavailable,
    });
    return item;
  }

  @Get('coach/:id')
  async listCoach(@Req() req: any, @Param('id') id: string) {
    const coachId = Number(id);
    if (Number.isNaN(coachId)) {
      throw new NotFoundException('教练不存在');
    }

    const requester = await this.users.findById(req.user.sub);
    if (!requester) {
      throw new NotFoundException('用户不存在');
    }

    const coach = await this.users.findCoachById(coachId);
    if (!coach) {
      throw new NotFoundException('教练不存在');
    }

    const sameSchool = requester.schoolId != null && requester.schoolId === coach.schoolId;

    if (requester.role === UserRole.student) {
      if (!sameSchool) {
        throw new ForbiddenException('无权查看该教练的不可用时间');
      }
    } else if (requester.role === UserRole.coach) {
      const isManager = Boolean((requester as any).isManager);
      if (requester.id !== coachId && (!isManager || !sameSchool)) {
        throw new ForbiddenException('无权查看该教练的不可用时间');
      }
    }

    return this.svc.listForUser(coachId);
  }

  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() body: { startTime?: string; endTime?: string; repeat?: 'always'|'once'; isUnavailable?: boolean }) {
    const patch: any = { ...body };
    if (body.startTime) patch.startTime = new Date(body.startTime);
    if (body.endTime) patch.endTime = new Date(body.endTime);
    return this.svc.update(req.user.sub, +id, patch);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.sub, +id);
  }
}
