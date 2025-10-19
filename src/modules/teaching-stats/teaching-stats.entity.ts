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
import { School } from '../schools/school.entity';

export enum StatPeriod {
  daily = 'daily',
  weekly = 'weekly',
  monthly = 'monthly',
  yearly = 'yearly',
}

@Entity('teaching_stats')
export class TeachingStats {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'coach_id' })
  coachId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coach_id' })
  coach!: User;

  @Column({ type: 'bigint', name: 'school_id' })
  schoolId!: number;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school!: School;

  @Column({ type: 'enum', enum: StatPeriod })
  period!: StatPeriod;

  @Column({ type: 'date', name: 'stat_date' })
  statDate!: Date;

  @Column({ type: 'int', default: 0, name: 'total_students' })
  totalStudents!: number;

  @Column({ type: 'int', default: 0, name: 'active_students' })
  activeStudents!: number;

  @Column({ type: 'int', default: 0, name: 'new_students' })
  newStudents!: number;

  @Column({ type: 'int', default: 0, name: 'videos_created' })
  videosCreated!: number;

  @Column({ type: 'int', default: 0, name: 'total_video_views' })
  totalVideoViews!: number;

  @Column({ type: 'int', default: 0, name: 'total_video_likes' })
  totalVideoLikes!: number;

  @Column({ type: 'int', default: 0, name: 'total_watch_time_seconds' })
  totalWatchTimeSeconds!: number;

  @Column({ type: 'int', default: 0, name: 'completed_videos' })
  completedVideos!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'average_completion_rate' })
  averageCompletionRate!: number;

  @Column({ type: 'int', default: 0, name: 'appointments_scheduled' })
  appointmentsScheduled!: number;

  @Column({ type: 'int', default: 0, name: 'appointments_completed' })
  appointmentsCompleted!: number;

  @Column({ type: 'int', default: 0, name: 'messages_sent' })
  messagesSent!: number;

  @Column({ type: 'int', default: 0, name: 'messages_received' })
  messagesReceived!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Index(['coach_id', 'period', 'stat_date'], { unique: true })
  static readonly uniqueCoachPeriodDate: any;

  @Index(['school_id', 'period', 'stat_date'])
  static readonly schoolPeriodDateIndex: any;
}

@Entity('school_stats')
export class SchoolStats {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'school_id' })
  schoolId!: number;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school!: School;

  @Column({ type: 'enum', enum: StatPeriod })
  period!: StatPeriod;

  @Column({ type: 'date', name: 'stat_date' })
  statDate!: Date;

  @Column({ type: 'int', default: 0, name: 'total_coaches' })
  totalCoaches!: number;

  @Column({ type: 'int', default: 0, name: 'active_coaches' })
  activeCoaches!: number;

  @Column({ type: 'int', default: 0, name: 'total_students' })
  totalStudents!: number;

  @Column({ type: 'int', default: 0, name: 'active_students' })
  activeStudents!: number;

  @Column({ type: 'int', default: 0, name: 'new_students' })
  newStudents!: number;

  @Column({ type: 'int', default: 0, name: 'total_videos' })
  totalVideos!: number;

  @Column({ type: 'int', default: 0, name: 'videos_created' })
  videosCreated!: number;

  @Column({ type: 'int', default: 0, name: 'total_video_views' })
  totalVideoViews!: number;

  @Column({ type: 'int', default: 0, name: 'total_video_likes' })
  totalVideoLikes!: number;

  @Column({ type: 'int', default: 0, name: 'total_watch_time_seconds' })
  totalWatchTimeSeconds!: number;

  @Column({ type: 'int', default: 0, name: 'completed_videos' })
  completedVideos!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'average_completion_rate' })
  averageCompletionRate!: number;

  @Column({ type: 'int', default: 0, name: 'total_appointments' })
  totalAppointments!: number;

  @Column({ type: 'int', default: 0, name: 'appointments_scheduled' })
  appointmentsScheduled!: number;

  @Column({ type: 'int', default: 0, name: 'appointments_completed' })
  appointmentsCompleted!: number;

  @Column({ type: 'int', default: 0, name: 'total_messages' })
  totalMessages!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, name: 'revenue' })
  revenue!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Index(['school_id', 'period', 'stat_date'], { unique: true })
  static readonly uniqueSchoolPeriodDate: any;
}

@Entity('student_performance_stats')
export class StudentPerformanceStats {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'student_id' })
  studentId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student!: User;

  @Column({ type: 'bigint', name: 'coach_id' })
  coachId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coach_id' })
  coach!: User;

  @Column({ type: 'bigint', name: 'school_id' })
  schoolId!: number;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school!: School;

  @Column({ type: 'enum', enum: StatPeriod })
  period!: StatPeriod;

  @Column({ type: 'date', name: 'stat_date' })
  statDate!: Date;

  @Column({ type: 'int', default: 0, name: 'videos_watched' })
  videosWatched!: number;

  @Column({ type: 'int', default: 0, name: 'videos_completed' })
  videosCompleted!: number;

  @Column({ type: 'int', default: 0, name: 'total_watch_time_seconds' })
  totalWatchTimeSeconds!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'average_completion_rate' })
  averageCompletionRate!: number;

  @Column({ type: 'int', default: 0, name: 'learning_streak_days' })
  learningStreakDays!: number;

  @Column({ type: 'int', default: 0, name: 'achievements_unlocked' })
  achievementsUnlocked!: number;

  @Column({ type: 'int', default: 0, name: 'appointments_attended' })
  appointmentsAttended!: number;

  @Column({ type: 'int', default: 0, name: 'messages_sent' })
  messagesSent!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'engagement_score' })
  engagementScore!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Index(['student_id', 'period', 'stat_date'], { unique: true })
  static readonly uniqueStudentPeriodDate: any;

  @Index(['coach_id', 'period', 'stat_date'])
  static readonly coachPeriodDateIndex: any;

  @Index(['school_id', 'period', 'stat_date'])
  static readonly schoolPeriodDateIndex: any;
}