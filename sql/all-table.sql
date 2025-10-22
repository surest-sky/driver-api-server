CREATE TABLE `appointment_comments` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  `appointment_id` bigint NOT NULL COMMENT '约课ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `user_name` varchar(191) NOT NULL COMMENT '用户名',
  `role` varchar(32) NOT NULL COMMENT '角色：student/coach',
  `content` text NOT NULL COMMENT '评论内容',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_comment_appointment` (`appointment_id`),
  KEY `idx_comment_user` (`user_id`),
  CONSTRAINT `fk_comment_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='约课评论表'

CREATE TABLE `appointments` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '预约唯一标识符',
  `student_id` bigint NOT NULL COMMENT '学员ID，外键关联users表',
  `coach_id` bigint NOT NULL COMMENT '教练ID，外键关联users表',
  `start_time` datetime NOT NULL COMMENT '预约开始时间',
  `end_time` datetime NOT NULL COMMENT '预约结束时间',
  `status` enum('pending','confirmed','rejected','cancelled','completed','no_show') NOT NULL DEFAULT 'pending' COMMENT '预约状态：待确认/已确认/已拒绝/已取消/已完成/缺席',
  `type` enum('regular','trial','exam','makeup') NOT NULL DEFAULT 'regular' COMMENT '预约类型：常规训练/试学课程/考试/补课',
  `location` varchar(191) DEFAULT NULL COMMENT '训练地点',
  `notes` text COMMENT '预约备注信息',
  `coach_notes` text COMMENT '教练备注',
  `student_notes` text COMMENT '学员备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '预约创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '预约更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_appointments_student_id` (`student_id`),
  KEY `idx_appointments_coach_id` (`coach_id`),
  KEY `idx_appointments_start_time` (`start_time`),
  KEY `idx_appointments_end_time` (`end_time`),
  KEY `idx_appointments_status` (`status`),
  KEY `idx_appointments_time_range` (`start_time`,`end_time`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='训练预约表'

CREATE TABLE `availability` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `repeat` enum('always','once') NOT NULL DEFAULT 'always' COMMENT '重复频率',
  `is_unavailable` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否不可用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_availability_user` (`user_id`),
  KEY `idx_availability_time` (`start_time`,`end_time`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='个人不可用时间'

CREATE TABLE `conversations` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '对话唯一标识符',
  `participant1_id` bigint NOT NULL COMMENT '参与者1的ID，外键关联users表',
  `participant1_name` varchar(191) NOT NULL COMMENT '参与者1姓名',
  `participant2_id` bigint NOT NULL COMMENT '参与者2的ID，外键关联users表',
  `participant2_name` varchar(191) NOT NULL COMMENT '参与者2姓名',
  `last_message_at` datetime DEFAULT NULL COMMENT '最后一条消息时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_conversations_participant1` (`participant1_id`),
  KEY `idx_conversations_participant2` (`participant2_id`),
  KEY `idx_conversations_last_message` (`last_message_at`),
  CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`participant1_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `conversations_ibfk_2` FOREIGN KEY (`participant2_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='对话会话表'

CREATE TABLE `invites` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '邀请码唯一标识符',
  `code` varchar(64) NOT NULL COMMENT '邀请码',
  `inviter_id` bigint DEFAULT NULL COMMENT '邀请人ID，外键关联users表',
  `invitee_email` varchar(191) NOT NULL COMMENT '被邀请人邮箱',
  `school_id` bigint NOT NULL COMMENT '所属驾校ID，外键关联schools表',
  `role` enum('student','coach') NOT NULL DEFAULT 'student' COMMENT '邀请角色：学员或教练',
  `status` enum('pending','accepted','expired') NOT NULL DEFAULT 'pending' COMMENT '邀请状态：待接受/已接受/已过期',
  `expires_at` datetime NOT NULL COMMENT '过期时间',
  `used_at` datetime DEFAULT NULL COMMENT '使用时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_invites_code` (`code`),
  KEY `idx_invites_inviter_id` (`inviter_id`),
  KEY `idx_invites_school_id` (`school_id`),
  KEY `idx_invites_status` (`status`),
  KEY `idx_invites_expires_at` (`expires_at`),
  CONSTRAINT `invites_ibfk_1` FOREIGN KEY (`inviter_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `invites_ibfk_2` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='邀请码表'

CREATE TABLE `messages` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '消息唯一标识符',
  `conversation_id` bigint NOT NULL COMMENT '所属对话ID，外键关联conversations表',
  `sender_id` bigint NOT NULL COMMENT '发送者ID，外键关联users表',
  `sender_name` varchar(191) NOT NULL COMMENT '发送者姓名',
  `receiver_id` bigint NOT NULL COMMENT '接收者ID，外键关联users表',
  `receiver_name` varchar(191) NOT NULL COMMENT '接收者姓名',
  `content` text NOT NULL COMMENT '消息内容',
  `message_type` enum('text','image','file','system') NOT NULL DEFAULT 'text' COMMENT '消息类型：文本/图片/文件/系统消息',
  `read_at` datetime DEFAULT NULL COMMENT '阅读时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_messages_conversation_id` (`conversation_id`),
  KEY `idx_messages_sender_id` (`sender_id`),
  KEY `idx_messages_receiver_id` (`receiver_id`),
  KEY `idx_messages_created_at` (`created_at`),
  KEY `idx_messages_read_at` (`read_at`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `messages_ibfk_3` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=48 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='消息表'

CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '通知唯一标识符',
  `user_id` bigint NOT NULL COMMENT '接收通知的用户ID，外键关联users表',
  `title` varchar(191) NOT NULL COMMENT '通知标题',
  `content` text NOT NULL COMMENT '通知内容',
  `type` enum('appointment','system','message') NOT NULL DEFAULT 'system' COMMENT '通知类型：预约/系统/消息',
  `read_at` datetime DEFAULT NULL COMMENT '阅读时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_id` (`user_id`),
  KEY `idx_notifications_type` (`type`),
  KEY `idx_notifications_created_at` (`created_at`),
  KEY `idx_notifications_read_at` (`read_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='通知消息表'

CREATE TABLE `policies` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '规章制度唯一标识符',
  `school_id` bigint NOT NULL COMMENT '所属驾校ID，外键关联schools表',
  `title` varchar(191) NOT NULL COMMENT '规章标题',
  `content` text NOT NULL COMMENT '规章内容',
  `type` enum('rule','notice','announcement') NOT NULL DEFAULT 'rule' COMMENT '类型：规则/通知/公告',
  `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal' COMMENT '优先级：低/普通/高/紧急',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否有效',
  `effective_date` date DEFAULT NULL COMMENT '生效日期',
  `created_by` bigint DEFAULT NULL COMMENT '创建者ID，外键关联users表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  KEY `idx_policies_school_id` (`school_id`),
  KEY `idx_policies_type` (`type`),
  KEY `idx_policies_priority` (`priority`),
  KEY `idx_policies_is_active` (`is_active`),
  KEY `idx_policies_effective_date` (`effective_date`),
  CONSTRAINT `policies_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `policies_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='驾校规章制度表'

CREATE TABLE `schools` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '驾校唯一标识符',
  `code` varchar(64) NOT NULL COMMENT '驾校代码，用于识别不同驾校',
  `name` varchar(191) NOT NULL COMMENT '驾校名称',
  `logo_url` varchar(255) DEFAULT NULL COMMENT '驾校logo图片链接',
  `driving_school_code` varchar(255) DEFAULT NULL COMMENT '学校唯一码',
  `banner_url` varchar(255) DEFAULT NULL COMMENT '驾校横幅图片链接',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='驾校信息表'

CREATE TABLE `student_coach_relations` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '关联关系唯一标识符',
  `student_id` bigint NOT NULL COMMENT '学员ID，外键关联users表',
  `coach_id` bigint NOT NULL COMMENT '教练ID，外键关联users表',
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
  `status` enum('active','inactive') NOT NULL DEFAULT 'active' COMMENT '关系状态：激活/停用',
  `notes` text COMMENT '备注信息',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_coach` (`student_id`,`coach_id`),
  KEY `idx_student_coach_student_id` (`student_id`),
  KEY `idx_student_coach_coach_id` (`coach_id`),
  KEY `idx_student_coach_status` (`status`),
  CONSTRAINT `student_coach_relations_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `student_coach_relations_ibfk_2` FOREIGN KEY (`coach_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='学生-教练关联关系表'

CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '用户唯一标识符',
  `email` varchar(191) NOT NULL COMMENT '用户邮箱，作为登录凭证',
  `password_hash` varchar(255) DEFAULT NULL COMMENT '密码哈希值，首次登录时为空',
  `name` varchar(191) NOT NULL DEFAULT '' COMMENT '用户姓名',
  `avatar_url` varchar(255) DEFAULT NULL COMMENT '头像图片链接',
  `birth_date` date DEFAULT NULL COMMENT '出生日期',
  `role` enum('student','coach') NOT NULL DEFAULT 'student' COMMENT '用户角色：学员或教练',
  `school_id` bigint DEFAULT NULL COMMENT '所属驾校ID，外键关联schools表',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_school_id` (`school_id`),
  KEY `idx_users_role` (`role`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户信息表'


CREATE TABLE IF NOT EXISTS `app_updates` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '版本记录ID',
  `platform` enum('ios','android') NOT NULL COMMENT '平台类型',
  `version` varchar(32) NOT NULL COMMENT '语义化版本号',
  `build_number` int NOT NULL DEFAULT '1' COMMENT '构建号（可用于展示）',
  `version_code` int NOT NULL DEFAULT '1' COMMENT '版本号（用于比较）',
  `download_url` varchar(512) NOT NULL COMMENT '下载地址',
  `release_notes` text COMMENT '更新说明',
  `force_update` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否强制更新',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否有效',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_app_updates_platform_version` (`platform`,`version_code`),
  KEY `idx_app_updates_platform_created` (`platform`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='应用版本记录表';
