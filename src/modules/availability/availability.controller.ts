import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AvailabilityService } from './availability.service';

@UseGuards(JwtAuthGuard)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly svc: AvailabilityService) {}

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

