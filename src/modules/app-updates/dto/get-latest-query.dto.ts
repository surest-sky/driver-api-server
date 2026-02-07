import { IsEnum } from 'class-validator';
import { AppPlatform } from '../app-update.entity';

export class GetLatestQueryDto {
  @IsEnum(AppPlatform, { message: 'platform must be ios or android' })
  platform!: AppPlatform;
}
