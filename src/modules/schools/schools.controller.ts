import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SchoolsService } from './schools.service';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';

class UpdateSchoolDto {
  name?: string;
  logoUrl?: string;
  bannerUrl?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private readonly svc: SchoolsService) {}

  @Get('me')
  @Roles('coach')
  me(@Req() req: any) {
    return this.svc.getForCoach(req.user.sub);
  }

  @Patch('me')
  @Roles('coach')
  update(@Req() req: any, @Body() dto: UpdateSchoolDto) {
    return this.svc.updateForCoach(req.user.sub, dto);
  }
}
