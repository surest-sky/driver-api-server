import { BadRequestException, Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SchoolsService } from './schools.service';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';

class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
    { message: 'logoUrl 必须是有效的 URL' },
  )
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
    { message: 'bannerUrl 必须是有效的 URL' },
  )
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

@Controller('schools')
export class SchoolsPublicController {
  constructor(private readonly svc: SchoolsService) {}

  @Get('check')
  async check(@Query('code') code?: string) {
    if (!code || !code.trim()) {
      throw new BadRequestException('code query parameter is required');
    }

    const normalized = code.trim().toUpperCase();
    const school = await this.svc.findByDrivingSchoolCode(normalized);
    if (!school) {
      return { exists: false };
    }
    return {
      exists: true,
      school: {
        id: school.id,
        name: school.name,
        code: school.code,
        drivingSchoolCode: school.drivingSchoolCode,
        logoUrl: school.logoUrl,
        bannerUrl: school.bannerUrl,
      },
    };
  }
}
