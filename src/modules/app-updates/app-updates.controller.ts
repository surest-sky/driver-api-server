import { Controller, Get, Query } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AppPlatform } from './app-update.entity';
import { AppUpdatesService } from './app-updates.service';

class CheckUpdateQuery {
  @IsEnum(AppPlatform, { message: 'platform 应为 ios 或 android' })
  platform!: AppPlatform;

  @IsOptional()
  @IsString()
  currentVersion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currentBuild?: number;
}

@Controller('app-updates')
export class AppUpdatesController {
  constructor(private readonly service: AppUpdatesService) {}

  @Get('check')
  async check(@Query() query: CheckUpdateQuery) {
    const { platform, currentVersion, currentBuild } = query;
    const { hasUpdate, latest } = await this.service.checkForUpdate(
      platform,
      currentVersion,
      currentBuild
    );

    if (!latest) {
      return {
        hasUpdate: false,
        latest: null,
      };
    }

    return {
      hasUpdate,
      forceUpdate: hasUpdate ? latest.forceUpdate : false,
      latest: {
        version: latest.version,
        buildNumber: latest.buildNumber,
        versionCode: latest.versionCode,
        downloadUrl: latest.downloadUrl,
        releaseNotes: latest.releaseNotes ?? '',
        forceUpdate: latest.forceUpdate,
        createdAt: latest.createdAt,
      },
    };
  }
}
