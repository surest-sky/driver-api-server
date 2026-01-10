-- ============================================
-- 消息表字段简化：移除冗余字段，新增 sender 枚举
-- ============================================
-- 执行时间: 2025-01-09
-- 描述:
--   1. 添加 sender 枚举字段 ('coach' | 'student')
--   2. 根据 sender_id 和 coach_id 迁移数据
--   3. 删除 sender_id, receiver_id, sender_name, receiver_name
--   4. 调整索引
-- ============================================

-- === 第一步：添加 sender 枚举字段 ===
ALTER TABLE messages
ADD COLUMN sender ENUM('coach', 'student') NULL COMMENT '发送者角色'
AFTER student_id;

-- === 第二步：数据迁移 ===
-- 根据 sender_id 和 coach_id 推断 sender
-- 如果 sender_id == coach_id，则是教练发送；否则是学员发送
UPDATE messages
SET sender = CASE
    WHEN sender_id = coach_id THEN 'coach'
    ELSE 'student'
END
WHERE sender IS NULL;

-- === 第三步：将 sender 设为 NOT NULL ===
ALTER TABLE messages
MODIFY COLUMN sender ENUM('coach', 'student') NOT NULL;

-- === 第四步：删除外键约束 ===
ALTER TABLE messages
DROP FOREIGN KEY messages_ibfk_2,
DROP FOREIGN KEY messages_ibfk_3;

-- === 第五步：删除旧索引 ===
ALTER TABLE messages
DROP INDEX sender_id,
DROP INDEX receiver_id;

-- === 第六步：删除冗余字段 ===
ALTER TABLE messages
DROP COLUMN sender_id,
DROP COLUMN receiver_id,
DROP COLUMN sender_name,
DROP COLUMN receiver_name;

-- === 第七步：添加新索引 ===
-- 添加复合索引，优化查询性能
ALTER TABLE messages
ADD INDEX idx_coach_student_sender (coach_id, student_id, sender);

-- === 验证迁移结果 ===
-- 检查表结构
DESCRIBE messages;

-- 检查数据完整性
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN sender = 'coach' THEN 1 ELSE 0 END) as coach_count,
    SUM(CASE WHEN sender = 'student' THEN 1 ELSE 0 END) as student_count
FROM messages;
