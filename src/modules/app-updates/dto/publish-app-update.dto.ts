import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AppPlatform } from '../app-update.entity';

export class PublishAppUpdateDto {
  @IsEnum(AppPlatform, { message: 'platform must be ios or android' })
  platform!: AppPlatform;

  @IsString()
  version!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionCode!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  buildNumber!: number;

  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @Type(() => Boolean)
  @IsBoolean()
  forceUpdate!: boolean;

  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  playStoreUrl?: string;

  @IsOptional()
  @IsString()
  appStoreUrl?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
