import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { AppPlatform } from '../app-update.entity';

export class CheckUpdateQueryDto {
  @IsEnum(AppPlatform, { message: 'platform must be ios or android' })
  platform!: AppPlatform;

  @IsOptional()
  @IsString()
  currentVersion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currentBuild?: number;
}
