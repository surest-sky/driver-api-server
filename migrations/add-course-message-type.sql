-- 扩展 messages.message_type 枚举，支持课程消息
-- 执行前请确认当前库已使用新的 coach_id/student_id 结构

ALTER TABLE messages
  MODIFY COLUMN message_type
  ENUM('text', 'image', 'file', 'system', 'course')
  NOT NULL
  DEFAULT 'text'
  COMMENT '消息类型：文本/图片/文件/系统消息/课程';
