-- 视频表
CREATE TABLE `videos` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '视频唯一标识符',
  `school_id` bigint NOT NULL COMMENT '所属驾校ID，外键关联schools表',
  `title` varchar(191) NOT NULL COMMENT '视频标题',
  `description` text COMMENT '视频描述',
  `video_url` varchar(500) NOT NULL COMMENT '视频播放地址',
  `thumbnail_url` varchar(500) DEFAULT NULL COMMENT '视频缩略图',
  `duration` int NOT NULL DEFAULT 0 COMMENT '视频时长（秒）',
  `type` enum('teaching','recording') NOT NULL DEFAULT 'teaching' COMMENT '视频类型：教学视频/拍摄记录',
  `category` varchar(100) DEFAULT NULL COMMENT '视频分类',
  `tags` varchar(500) DEFAULT NULL COMMENT '视频标签，逗号分隔',
  `view_count` int NOT NULL DEFAULT 0 COMMENT '观看次数',
  `like_count` int NOT NULL DEFAULT 0 COMMENT '点赞数',
  `uploaded_by` bigint NOT NULL COMMENT '上传者ID，外键关联users表',
  `student_id` bigint DEFAULT NULL COMMENT '关联学生ID（仅拍摄记录类型）',
  `coach_id` bigint DEFAULT NULL COMMENT '关联教练ID（仅拍摄记录类型）',
  `is_published` tinyint(1) NOT NULL DEFAULT 1 COMMENT '是否已发布',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_videos_school_id` (`school_id`),
  KEY `idx_videos_type` (`type`),
  KEY `idx_videos_uploaded_by` (`uploaded_by`),
  KEY `idx_videos_student_id` (`student_id`),
  KEY `idx_videos_coach_id` (`coach_id`),
  KEY `idx_videos_created_at` (`created_at`),
  KEY `idx_videos_is_published` (`is_published`),
  CONSTRAINT `videos_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `videos_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `videos_ibfk_3` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `videos_ibfk_4` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='视频表';

-- 视频评论表
CREATE TABLE `video_comments` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  `video_id` bigint NOT NULL COMMENT '视频ID，外键关联videos表',
  `user_id` bigint NOT NULL COMMENT '评论用户ID，外键关联users表',
  `user_name` varchar(191) NOT NULL COMMENT '评论用户名',
  `user_role` varchar(32) NOT NULL COMMENT '用户角色：student/coach',
  `content` text NOT NULL COMMENT '评论内容',
  `parent_id` bigint DEFAULT NULL COMMENT '父评论ID（用于回复）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_video_comments_video_id` (`video_id`),
  KEY `idx_video_comments_user_id` (`user_id`),
  KEY `idx_video_comments_parent_id` (`parent_id`),
  KEY `idx_video_comments_created_at` (`created_at`),
  CONSTRAINT `video_comments_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `video_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `video_comments_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `video_comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='视频评论表';

-- 学习记录表
CREATE TABLE `learning_records` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '学习记录ID',
  `user_id` bigint NOT NULL COMMENT '学生ID，外键关联users表',
  `video_id` bigint NOT NULL COMMENT '视频ID，外键关联videos表',
  `watch_duration` int NOT NULL DEFAULT 0 COMMENT '观看时长（秒）',
  `progress` decimal(5,2) NOT NULL DEFAULT 0.00 COMMENT '观看进度（百分比，0-100）',
  `last_watch_position` int NOT NULL DEFAULT 0 COMMENT '最后观看位置（秒）',
  `is_completed` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否完成观看',
  `first_watched_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '首次观看时间',
  `last_watched_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后观看时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_video` (`user_id`, `video_id`),
  KEY `idx_learning_records_user_id` (`user_id`),
  KEY `idx_learning_records_video_id` (`video_id`),
  KEY `idx_learning_records_progress` (`progress`),
  KEY `idx_learning_records_completed` (`is_completed`),
  KEY `idx_learning_records_last_watched` (`last_watched_at`),
  CONSTRAINT `learning_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `learning_records_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='学习记录表';

-- 视频收藏表
CREATE TABLE `video_favorites` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '收藏记录ID',
  `video_id` bigint NOT NULL COMMENT '视频ID，外键关联videos表',
  `user_id` bigint NOT NULL COMMENT '用户ID，外键关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_video_favorites_user_video` (`user_id`, `video_id`),
  KEY `idx_video_favorites_video_id` (`video_id`),
  KEY `idx_video_favorites_created_at` (`created_at`),
  CONSTRAINT `video_favorites_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `video_favorites_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='视频收藏表';
