import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum AppPlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

@Entity('app_updates')
export class AppUpdate {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'enum', enum: AppPlatform })
  platform!: AppPlatform;

  @Column({ type: 'varchar', length: 32 })
  version!: string;

  @Column({ name: 'build_number', type: 'int', default: 1 })
  buildNumber!: number;

  @Column({ name: 'version_code', type: 'int', default: 1 })
  versionCode!: number;

  @Column({ name: 'download_url', type: 'varchar', length: 512 })
  downloadUrl!: string;

  @Column({ name: 'release_notes', type: 'text', nullable: true })
  releaseNotes?: string | null;

  @Column({ name: 'force_update', type: 'tinyint', width: 1, default: false })
  forceUpdate!: boolean;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
