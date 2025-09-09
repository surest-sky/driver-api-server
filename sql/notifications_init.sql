-- 通知系统初始化SQL

-- 创建通知表（如果使用synchronize: false）
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(64) NOT NULL,
  type ENUM('appointment', 'message', 'invite', 'system', 'reminder') NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  data JSON,
  status ENUM('unread', 'read', 'deleted') DEFAULT 'unread',
  actionUrl VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_userId (userId),
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_createdAt (createdAt)
);

-- 插入示例通知数据
INSERT INTO notifications (id, userId, type, title, content, data, status, actionUrl, createdAt) VALUES
-- 系统通知
(UUID(), 'user-001', 'system', '欢迎使用DriveHub', '欢迎您使用DriveHub驾驶培训管理平台！我们致力于为您提供最佳的学习体验。', '{"welcome": true}', 'unread', '/welcome', NOW() - INTERVAL 1 HOUR),
(UUID(), 'user-002', 'system', '平台功能更新', '我们新增了视频学习和在线约课功能，快来体验吧！', '{"version": "1.1.0"}', 'read', '/features', NOW() - INTERVAL 2 DAY),

-- 预约通知
(UUID(), 'user-001', 'appointment', '预约确认', '您的驾驶课程预约已确认，时间：2025年1月8日 14:00-16:00', '{"appointmentId": "appt-001", "time": "2025-01-08 14:00"}', 'unread', '/appointments/appt-001', NOW() - INTERVAL 30 MINUTE),
(UUID(), 'user-002', 'appointment', '课程提醒', '您有一节驾驶课程即将开始，请准时参加。', '{"appointmentId": "appt-002", "time": "2025-01-09 10:00"}', 'unread', '/appointments/appt-002', NOW() - INTERVAL 10 MINUTE),

-- 消息通知  
(UUID(), 'user-001', 'message', '来自王教练的消息', '今天的练习很不错，继续保持！有问题随时联系我。', '{"messageId": "msg-001", "senderId": "coach-001", "senderName": "王教练"}', 'unread', '/messages/msg-001', NOW() - INTERVAL 45 MINUTE),
(UUID(), 'user-002', 'message', '来自学员小李的消息', '教练，明天的课程能调整到下午吗？', '{"messageId": "msg-002", "senderId": "user-003", "senderName": "小李"}', 'read', '/messages/msg-002', NOW() - INTERVAL 3 HOUR),

-- 邀约通知
(UUID(), 'user-001', 'invite', '收到新的学习邀约', '张教练邀请您参加驾驶培训课程', '{"inviteId": "inv-001", "coachId": "coach-002", "coachName": "张教练"}', 'unread', '/invites/inv-001', NOW() - INTERVAL 20 MINUTE),
(UUID(), 'user-002', 'invite', '邀约状态更新', '您对李教练的邀约已被接受', '{"inviteId": "inv-002", "coachId": "coach-003", "coachName": "李教练"}', 'read', '/invites/inv-002', NOW() - INTERVAL 1 DAY),

-- 学习提醒
(UUID(), 'user-001', 'reminder', '学习提醒', '您已经3天没有进行驾驶练习了，记得安排时间练习哦！', '{"lastPractice": "2025-01-05"}', 'unread', '/practice', NOW() - INTERVAL 5 MINUTE),
(UUID(), 'user-002', 'reminder', '理论学习提醒', '别忘了完成今天的理论知识学习，已为您准备了新的学习内容。', '{"topic": "traffic_rules", "progress": 75}', 'unread', '/study', NOW() - INTERVAL 2 HOUR);

-- 给更多用户创建通知（如果有更多用户数据的话）
-- INSERT INTO notifications (id, userId, type, title, content, status, createdAt) VALUES ...