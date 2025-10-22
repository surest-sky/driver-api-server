import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany
} from 'typeorm';
import { User } from '../users/user.entity';
import { School } from '../schools/school.entity';

export enum VideoType {
  teaching = 'teaching',
  recording = 'recording',
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', name: 'school_id' })
  schoolId!: number;

  @Column({ type: 'varchar', length: 191 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500, name: 'video_url' })
  videoUrl!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'thumbnail_url' })
  thumbnailUrl?: string;

  @Column({ type: 'int', default: 0 })
  duration!: number;

  @Column({ type: 'enum', enum: VideoType, default: VideoType.teaching })
  type!: VideoType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  tags?: string;

  @Column({ type: 'int', default: 0, name: 'view_count' })
  viewCount!: number;

  @Column({ type: 'int', default: 0, name: 'like_count' })
  likeCount!: number;

  @Column({ type: 'bigint', name: 'uploaded_by' })
  uploadedBy!: number;

  @Column({ type: 'bigint', nullable: true, name: 'student_id' })
  studentId?: number;

  @Column({ type: 'bigint', nullable: true, name: 'coach_id' })
  coachId?: number;

  @Column({ type: 'tinyint', default: 1, name: 'is_published' })
  isPublished!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school?: School;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coach_id' })
  coach?: User;

  @OneToMany(() => VideoComment, comment => comment.video)
  comments?: VideoComment[];

  @OneToMany(() => LearningRecord, record => record.video)
  learningRecords?: LearningRecord[];
}

@Entity('video_comments')
export class VideoComment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', name: 'video_id' })
  videoId!: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId!: number;

  @Column({ type: 'varchar', length: 191, name: 'user_name' })
  userName!: string;

  @Column({ type: 'varchar', length: 32, name: 'user_role' })
  userRole!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'bigint', nullable: true, name: 'parent_id' })
  parentId?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Video, video => video.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video!: Video;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => VideoComment, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: VideoComment;

  @OneToMany(() => VideoComment, comment => comment.parent)
  replies?: VideoComment[];
}

@Entity('learning_records')
export class LearningRecord {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint', name: 'user_id' })
  userId!: number;

  @Column({ type: 'bigint', name: 'video_id' })
  videoId!: number;

  @Column({ type: 'int', default: 0, name: 'watch_duration' })
  watchDuration!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.00 })
  progress!: number;

  @Column({ type: 'int', default: 0, name: 'last_watch_position' })
  lastWatchPosition!: number;

  @Column({ type: 'tinyint', default: 0, name: 'is_completed' })
  isCompleted!: boolean;

  @CreateDateColumn({ name: 'first_watched_at' })
  firstWatchedAt!: Date;

  @UpdateDateColumn({ name: 'last_watched_at' })
  lastWatchedAt!: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Video, video => video.learningRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video!: Video;
}