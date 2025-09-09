import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  key!: string; // 'privacy' | 'terms'

  @Column({ type: 'varchar', length: 16, default: 'zh-CN' })
  lang!: string;

  @Column({ type: 'longtext' })
  content!: string;
}

