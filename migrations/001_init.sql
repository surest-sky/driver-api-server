-- 用户表：存储学员和教练的基本信息
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(36) PRIMARY KEY COMMENT '用户唯一标识符',
  `email` varchar(191) NOT NULL UNIQUE COMMENT '用户邮箱，作为登录凭证',
  `passwordHash` varchar(255) NULL COMMENT '密码哈希值，首次登录时为空',
  `name` varchar(191) NOT NULL DEFAULT '' COMMENT '用户姓名',
  `avatarUrl` varchar(255) NULL COMMENT '头像图片链接',
  `birthDate` date NULL COMMENT '出生日期',
  `role` enum('student','coach') NOT NULL DEFAULT 'student' COMMENT '用户角色：学员或教练',
  `schoolCode` varchar(64) NULL COMMENT '所属驾校代码',
  `schoolName` varchar(191) NULL COMMENT '所属驾校名称',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';

-- 政策条款表：存储隐私政策、用户协议等文档
CREATE TABLE IF NOT EXISTS `policies` (
  `id` varchar(36) PRIMARY KEY COMMENT '政策文档唯一标识符',
  `key` varchar(64) NOT NULL COMMENT '政策类型标识（如privacy、terms）',
  `lang` varchar(16) NOT NULL DEFAULT 'zh-CN' COMMENT '语言代码',
  `content` longtext NOT NULL COMMENT '政策文档内容'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='政策条款表';

-- 会话表：存储学员与教练之间的对话会话信息
CREATE TABLE IF NOT EXISTS `conversations` (
  `id` varchar(36) PRIMARY KEY COMMENT '会话唯一标识符',
  `studentId` varchar(36) NOT NULL COMMENT '学员ID',
  `coachId` varchar(36) NOT NULL COMMENT '教练ID',
  `studentName` varchar(191) NOT NULL COMMENT '学员姓名',
  `coachName` varchar(191) NOT NULL COMMENT '教练姓名',
  `lastMessageAt` datetime NULL COMMENT '最后一条消息时间',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '会话创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '会话更新时间',
  INDEX (`studentId`) COMMENT '学员ID索引',
  INDEX (`coachId`) COMMENT '教练ID索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='对话会话表';

-- 消息表：存储会话中的具体消息内容
CREATE TABLE IF NOT EXISTS `messages` (
  `id` varchar(36) PRIMARY KEY COMMENT '消息唯一标识符',
  `conversationId` varchar(36) NOT NULL COMMENT '所属会话ID',
  `senderId` varchar(36) NOT NULL COMMENT '发送者用户ID',
  `receiverId` varchar(36) NOT NULL COMMENT '接收者用户ID',
  `senderName` varchar(191) NOT NULL COMMENT '发送者姓名',
  `receiverName` varchar(191) NOT NULL COMMENT '接收者姓名',
  `type` enum('text','image','video','file') NOT NULL DEFAULT 'text' COMMENT '消息类型：文本/图片/视频/文件',
  `status` enum('sending','sent','delivered','read','failed') NOT NULL DEFAULT 'sent' COMMENT '消息状态：发送中/已发送/已送达/已读/失败',
  `content` text NOT NULL COMMENT '消息内容',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '消息发送时间',
  `readAt` datetime NULL COMMENT '消息阅读时间',
  INDEX (`conversationId`) COMMENT '会话ID索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天消息表';

-- 邀请表：存储教练向学员发起的配对邀请记录
CREATE TABLE IF NOT EXISTS `invites` (
  `id` varchar(36) PRIMARY KEY COMMENT '邀请唯一标识符',
  `coachId` varchar(36) NOT NULL COMMENT '发起邀请的教练ID',
  `studentId` varchar(36) NOT NULL COMMENT '被邀请的学员ID',
  `status` enum('pending','success','failed') NOT NULL DEFAULT 'pending' COMMENT '邀请状态：待处理/成功/失败',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '邀请创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '邀请更新时间',
  INDEX (`coachId`) COMMENT '教练ID索引',
  INDEX (`studentId`) COMMENT '学员ID索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='师生配对邀请表';

-- 驾校表：存储驾校的基本信息和品牌资料
CREATE TABLE IF NOT EXISTS `schools` (
  `id` varchar(36) PRIMARY KEY COMMENT '驾校唯一标识符',
  `code` varchar(64) NOT NULL UNIQUE COMMENT '驾校代码，用于识别不同驾校',
  `name` varchar(191) NOT NULL COMMENT '驾校名称',
  `logoUrl` varchar(255) NULL COMMENT '驾校logo图片链接',
  `bannerUrl` varchar(255) NULL COMMENT '驾校横幅图片链接',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='驾校信息表';

-- 初始化数据：创建默认的测试学员和教练账户（密码哈希将在首次登录时创建）
INSERT IGNORE INTO `users` (`id`, `email`, `passwordHash`, `name`, `role`, `schoolCode`, `schoolName`)
VALUES
  ('student_001', 'student@driveviewer.com', NULL, 'Test Student', 'student', 'SH000001', '上海驾校'),
  ('coach_001', 'coach@driveviewer.com', NULL, 'Test Coach', 'coach', 'SH000001', '上海驾校');

-- 初始化数据：创建默认的政策条款文档
INSERT IGNORE INTO `policies` (`id`, `key`, `lang`, `content`)
VALUES
  (UUID(), 'privacy', 'zh-CN', '隐私政策：...'),
  (UUID(), 'terms', 'zh-CN', '用户协议：...');

