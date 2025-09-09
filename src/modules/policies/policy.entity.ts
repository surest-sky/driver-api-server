import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PolicyType = 'rule' | 'notice' | 'announcement';
export type PolicyPriority = 'low' | 'normal' | 'high' | 'urgent';

@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'bigint', name: 'school_id' })
  schoolId!: number;

  @Column({ type: 'varchar', length: 191 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Index()
  @Column({ type: 'enum', enum: ['rule', 'notice', 'announcement'], default: 'rule' })
  type!: PolicyType;

  @Index()
  @Column({ type: 'enum', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' })
  priority!: PolicyPriority;

  @Index()
  @Column({ type: 'tinyint', name: 'is_active', default: () => '1' })
  isActive!: boolean;

  @Column({ type: 'date', name: 'effective_date', nullable: true })
  effectiveDate!: Date | null;

  @Index()
  @Column({ type: 'bigint', name: 'created_by', nullable: true })
  createdBy!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
