-- 预约表：存储学员和教练之间的训练预约信息
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` varchar(36) PRIMARY KEY COMMENT '预约唯一标识符',
  `studentId` varchar(36) NOT NULL COMMENT '学员ID',
  `studentName` varchar(191) NOT NULL COMMENT '学员姓名',
  `coachId` varchar(36) NOT NULL COMMENT '教练ID',
  `coachName` varchar(191) NOT NULL COMMENT '教练姓名',
  `startTime` datetime NOT NULL COMMENT '预约开始时间',
  `endTime` datetime NOT NULL COMMENT '预约结束时间',
  `status` enum('pending','confirmed','rejected','cancelled','completed') NOT NULL DEFAULT 'pending' COMMENT '预约状态：待确认/已确认/已拒绝/已取消/已完成',
  `type` enum('regular','trial') NOT NULL DEFAULT 'regular' COMMENT '预约类型：常规训练/试学课程',
  `location` varchar(191) NULL COMMENT '训练地点',
  `notes` text NULL COMMENT '预约备注信息',
  `coachNotes` text NULL COMMENT '教练备注',
  `studentNotes` text NULL COMMENT '学员备注',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '预约创建时间',
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '预约更新时间',
  INDEX (`studentId`) COMMENT '学员ID索引',
  INDEX (`coachId`) COMMENT '教练ID索引',
  INDEX (`startTime`) COMMENT '开始时间索引',
  INDEX (`endTime`) COMMENT '结束时间索引'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='训练预约表';

-- 初始化数据：创建示例预约记录用于测试
INSERT IGNORE INTO `appointments` (`id`,`studentId`,`studentName`,`coachId`,`coachName`,`startTime`,`endTime`,`status`,`type`)
VALUES
  (UUID(), 'student_001','Test Student','coach_001','Test Coach', NOW() + INTERVAL 1 DAY, NOW() + INTERVAL 1 DAY + INTERVAL 1 HOUR, 'confirmed','regular');

