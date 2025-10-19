import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  Index, 
  PrimaryGeneratedColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { User } from '../users/user.entity';
import { Video } from '../videos/video.entity';
import { School } from '../schools/school.entity';

export enum LearningActionType {
  video_start = 'video_start',
  video_pause = 'video_pause',
  video_complete = 'video_complete',
  video_seek = 'video_seek',
  note_add = 'note_add',
  practice_start = 'practice_start',
  practice_complete = 'practice_complete',
  test_start = 'test_start',
  test_complete = 'test_complete',
}

@Entity('learning_records')
export class LearningRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @Column({ type: 'bigint', nullable: true, name: 'coach_id' })
  coachId?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coach_id' })
  coach?: User;

  @Column({ type: 'bigint', name: 'school_id' })
  schoolId!: number;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school!: School;

  @Column({ type: 'bigint', nullable: true, name: 'video_id' })
  videoId?: number;

  @ManyToOne(() => Video)
  @JoinColumn({ name: 'video_id' })
  video?: Video;

  @Column({ type: 'enum', enum: LearningActionType })
  action!: LearningActionType;

  @Column({ type: 'int', nullable: true, name: 'duration_seconds' })
  durationSeconds?: number;

  @Column({ type: 'int', nullable: true, name: 'progress_seconds' })
  progressSeconds?: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'completion_rate' })
  completionRate?: number;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Index(['student_id', 'created_at'])
  static readonly studentTimeIndex: any;

  @Index(['video_id', 'student_id'])
  static readonly videoStudentIndex: any;

  @Index(['school_id', 'created_at'])
  static readonly schoolTimeIndex: any;
}

@Entity('learning_progress')
export class LearningProgress {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @Column({ type: 'bigint', name: 'video_id' })
  videoId!: number;

  @ManyToOne(() => Video)
  @JoinColumn({ name: 'video_id' })
  video!: Video;

  @Column({ type: 'int', default: 0, name: 'watch_duration_seconds' })
  watchDurationSeconds!: number;

  @Column({ type: 'int', default: 0, name: 'last_position_seconds' })
  lastPositionSeconds!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'completion_rate' })
  completionRate!: number;

  @Column({ type: 'boolean', default: false, name: 'is_completed' })
  isCompleted!: boolean;

  @Column({ type: 'int', default: 0, name: 'watch_count' })
  watchCount!: number;

  @Column({ type: 'timestamp', nullable: true, name: 'first_watched_at' })
  firstWatchedAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_watched_at' })
  lastWatchedAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Index(['student_id', 'video_id'], { unique: true })
  static readonly uniqueProgress: any;
}

@Entity('learning_achievements')
export class LearningAchievement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @Column({ type: 'varchar', length: 100, name: 'achievement_type' })
  achievementType!: string; // 'first_video', 'video_streak', 'practice_hours', etc.

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int', nullable: true })
  level?: number;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @Column({ type: 'boolean', default: false, name: 'is_unlocked' })
  isUnlocked!: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'unlocked_at' })
  unlockedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Index(['student_id', 'achievement_type'])
  static readonly studentAchievementIndex: any;
}