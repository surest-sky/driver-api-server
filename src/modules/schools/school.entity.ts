import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 191 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'logo_url' })
  logoUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'driving_school_code' })
  drivingSchoolCode!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'banner_url' })
  bannerUrl!: string | null;

  @OneToMany(() => User, user => user.school)
  users!: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
