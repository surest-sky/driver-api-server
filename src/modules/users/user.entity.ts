import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { School } from '../schools/school.entity';
import { StudentCoachRelation } from './student-coach-relation.entity';

export enum UserRole {
  student = 'student',
  coach = 'coach',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 191 })
  email!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'password_hash' })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 191, default: '' })
  name!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'avatar_url' })
  avatarUrl!: string | null;

  @Column({ type: 'date', nullable: true, name: 'birth_date' })
  birthDate!: Date | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.student })
  role!: UserRole;

  @Column({ type: 'bigint', nullable: true, name: 'school_id' })
  schoolId!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'pending_school_code' })
  pendingSchoolCode!: string | null;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school!: School;

  // 学生的教练关系
  @OneToMany(() => StudentCoachRelation, relation => relation.student)
  coachRelations!: StudentCoachRelation[];

  // 教练的学生关系
  @OneToMany(() => StudentCoachRelation, relation => relation.coach)
  studentRelations!: StudentCoachRelation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
