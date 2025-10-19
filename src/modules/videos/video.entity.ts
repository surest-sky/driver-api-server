import { 
  Column, 
  CreateDateColumn, 
  Entity, 
  Index, 
  PrimaryGeneratedColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany
} from 'typeorm';
import { User } from '../users/user.entity';
import { School } from '../schools/school.entity';

export enum VideoStatus {
  processing = 'processing',
  ready = 'ready',
  error = 'error',
  deleted = 'deleted',
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500, name: 'file_path' })
  filePath!: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'thumbnail_path' })
  thumbnailPath?: string;

  @Column({ type: 'int', default: 0, name: 'duration_seconds' })
  durationSeconds!: number;

  @Column({ type: 'bigint', name: 'coach_id' })
  coachId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'coach_id' })
  coach!: User;

  @Column({ type: 'bigint', nullable: true, name: 'student_id' })
  studentId?: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student?: User;

  @Column({ type: 'bigint', name: 'school_id' })
  schoolId!: number;

  @ManyToOne(() => School)
  @JoinColumn({ name: 'school_id' })
  school!: School;

  @Column({ type: 'enum', enum: VideoStatus, default: VideoStatus.processing })
  status!: VideoStatus;

  @Column({ type: 'int', default: 0, name: 'view_count' })
  viewCount!: number;

  @Column({ type: 'boolean', default: false, name: 'is_public' })
  isPublic!: boolean;

  @Column({ type: 'int', default: 0, name: 'sort_order' })
  sortOrder!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'int', default: 0, name: 'like_count' })
  likeCount!: number;

  @Column({ type: 'timestamp', nullable: true, name: 'recorded_at' })
  recordedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => VideoNote, note => note.video, { cascade: true })
  videoNotes!: VideoNote[];

  @OneToMany(() => VideoInteraction, interaction => interaction.video, { cascade: true })
  interactions!: VideoInteraction[];
}

@Entity('video_notes')
export class VideoNote {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'video_id' })
  videoId!: number;

  @ManyToOne(() => Video, video => video.videoNotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video!: Video;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int', default: 0, name: 'timestamp_seconds' })
  timestampSeconds!: number;

  @Column({ type: 'bigint', name: 'author_id' })
  authorId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'author_id' })
  author!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

export enum InteractionType {
  like = 'like',
  favorite = 'favorite',
  view = 'view',
}

@Entity('video_interactions')
export class VideoInteraction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint', name: 'video_id' })
  videoId!: number;

  @ManyToOne(() => Video, video => video.interactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video!: Video;

  @Column({ type: 'bigint', name: 'user_id' })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'enum', enum: InteractionType })
  type!: InteractionType;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Index(['video_id', 'user_id', 'type'], { unique: true })
  static readonly uniqueInteraction: any;
}