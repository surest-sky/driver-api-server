import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppPlatform } from './app-update.entity';
import { AppUpdatesService } from './app-updates.service';
import { CheckUpdateQueryDto } from './dto/check-update-query.dto';
import { GetLatestQueryDto } from './dto/get-latest-query.dto';
import { PublishAppUpdateDto } from './dto/publish-app-update.dto';
import {
  APP_UPDATE_APP_STORE_URL,
  APP_UPDATE_PLAY_STORE_URL,
} from './app-update.constants';

@Controller('app-updates')
export class AppUpdatesController {
  constructor(private readonly service: AppUpdatesService) {}

  @Get('check')
  async check(@Query() query: CheckUpdateQueryDto) {
    const platform = normalizePlatform(query.platform);
    const currentVersion = query.currentVersion;
    const currentBuild = normalizeInt(query.currentBuild);
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
        downloadUrl: latest.downloadUrl ?? '',
        playStoreUrl: APP_UPDATE_PLAY_STORE_URL,
        appStoreUrl: APP_UPDATE_APP_STORE_URL,
        releaseNotes: latest.releaseNotes ?? '',
        forceUpdate: latest.forceUpdate,
        createdAt: latest.createdAt,
      },
    };
  }

  @Get('latest')
  async latest(@Query() query: GetLatestQueryDto) {
    const platform = normalizePlatform(query.platform);
    const latest = await this.service.getLatest(platform);
    if (!latest) {
      return null;
    }
    return {
      id: latest.id,
      platform: latest.platform,
      version: latest.version,
      buildNumber: latest.buildNumber,
      versionCode: latest.versionCode,
      downloadUrl: latest.downloadUrl ?? '',
      playStoreUrl: APP_UPDATE_PLAY_STORE_URL,
      appStoreUrl: APP_UPDATE_APP_STORE_URL,
      releaseNotes: latest.releaseNotes ?? '',
      forceUpdate: latest.forceUpdate,
      isActive: latest.isActive,
      createdAt: latest.createdAt,
    };
  }

  @Post('publish')
  async publish(@Body() dto: PublishAppUpdateDto) {
    const payload: PublishAppUpdateDto = {
      ...dto,
      platform: normalizePlatform(dto.platform),
      versionCode: normalizeRequiredInt(dto.versionCode, 'versionCode'),
      buildNumber: normalizeRequiredInt(dto.buildNumber, 'buildNumber'),
      forceUpdate: normalizeBool(dto.forceUpdate),
      isActive: dto.isActive === undefined ? true : normalizeBool(dto.isActive),
    };

    const created = await this.service.publishUpdate(payload);
    return {
      id: created.id,
      platform: created.platform,
      version: created.version,
      buildNumber: created.buildNumber,
      versionCode: created.versionCode,
      downloadUrl: created.downloadUrl ?? '',
      playStoreUrl: APP_UPDATE_PLAY_STORE_URL,
      appStoreUrl: APP_UPDATE_APP_STORE_URL,
      releaseNotes: created.releaseNotes ?? '',
      forceUpdate: created.forceUpdate,
      isActive: created.isActive,
      createdAt: created.createdAt,
    };
  }
}

function normalizePlatform(platform: unknown): AppPlatform {
  if (platform === AppPlatform.IOS || platform === AppPlatform.ANDROID) {
    return platform;
  }
  throw new BadRequestException('platform must be ios or android');
}

function normalizeInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.trunc(parsed);
}

function normalizeRequiredInt(value: unknown, field: string): number {
  const parsed = normalizeInt(value);
  if (parsed === undefined || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer`);
  }
  return parsed;
}

function normalizeBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return false;
}
