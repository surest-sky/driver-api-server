import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppPlatform, AppUpdate } from './app-update.entity';
import { PublishAppUpdateDto } from './dto/publish-app-update.dto';
import {
  APP_UPDATE_APP_STORE_URL,
  APP_UPDATE_PLAY_STORE_URL,
} from './app-update.constants';

@Injectable()
export class AppUpdatesService {
  constructor(
    @InjectRepository(AppUpdate)
    private readonly repo: Repository<AppUpdate>
  ) {}

  async getLatest(platform: AppPlatform): Promise<AppUpdate | null> {
    return this.repo.findOne({
      where: { platform, isActive: true },
      order: { versionCode: 'DESC', createdAt: 'DESC' },
    });
  }

  async publishUpdate(dto: PublishAppUpdateDto): Promise<AppUpdate> {
    this.validatePublishDto(dto);
    const created = this.repo.create({
      platform: dto.platform,
      version: dto.version.trim(),
      versionCode: Math.trunc(dto.versionCode),
      buildNumber: Math.trunc(dto.buildNumber),
      releaseNotes: dto.releaseNotes?.trim() ?? '',
      forceUpdate: dto.forceUpdate === true,
      downloadUrl: dto.downloadUrl?.trim() || null,
      playStoreUrl: dto.platform === AppPlatform.ANDROID ? APP_UPDATE_PLAY_STORE_URL : null,
      appStoreUrl: dto.platform === AppPlatform.IOS ? APP_UPDATE_APP_STORE_URL : null,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(created);
  }

  async checkForUpdate(
    platform: AppPlatform,
    currentVersion?: string,
    currentBuild?: number
  ) {
    const latest = await this.getLatest(platform);

    if (!latest) {
      return { hasUpdate: false, latest: null as AppUpdate | null };
    }

    const normalizedBuild =
      typeof currentBuild === 'number' && Number.isFinite(currentBuild)
        ? Math.trunc(currentBuild)
        : undefined;

    let hasUpdate = true;
    if (normalizedBuild !== undefined) {
      hasUpdate = latest.versionCode > normalizedBuild;
    } else if (currentVersion) {
      hasUpdate = compareVersionDigits(latest.version, currentVersion) > 0;
    }

    return {
      hasUpdate,
      latest,
    };
  }

  private validatePublishDto(dto: PublishAppUpdateDto): void {
    if (!dto.version?.trim()) {
      throw new BadRequestException('version is required');
    }
    if (dto.platform === AppPlatform.IOS) {
      return;
    }
    if (!dto.downloadUrl?.trim() && !dto.playStoreUrl?.trim()) {
      throw new BadRequestException('android requires downloadUrl or playStoreUrl');
    }
  }
}

function compareVersionDigits(a: string, b: string): number {
  const parse = (v: string): bigint => {
    const normalized = (v || '').replace(/[^0-9]/g, '');
    if (!normalized) return BigInt(0);
    return BigInt(normalized);
  };

  const av = parse(a);
  const bv = parse(b);
  if (av > bv) return 1;
  if (av < bv) return -1;
  return 0;
}
