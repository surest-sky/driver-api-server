import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppPlatform, AppUpdate } from './app-update.entity';

@Injectable()
export class AppUpdatesService {
  constructor(
    @InjectRepository(AppUpdate)
    private readonly repo: Repository<AppUpdate>
  ) {}

  async checkForUpdate(
    platform: AppPlatform,
    currentVersion?: string,
    currentBuild?: number
  ) {
    const latest = await this.repo.findOne({
      where: { platform, isActive: true },
      order: { versionCode: 'DESC', createdAt: 'DESC' },
    });

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
      hasUpdate = compareSemver(latest.version, currentVersion) > 0;
    }

    return {
      hasUpdate,
      latest,
    };
  }
}

function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .split('.')
      .map((part) => part.replace(/[^0-9]/g, ''))
      .map((part) => (part.length ? Number(part) : 0));

  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i += 1) {
    const ai = av[i] ?? 0;
    const bi = bv[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}
