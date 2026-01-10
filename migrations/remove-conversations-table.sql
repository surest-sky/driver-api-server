-- 激进方案：完全移除 conversations 表，简化消息系统
-- 新的数据结构：messages 表直接使用 coach_id 和 student_id

-- === 第一步：备份现有数据 ===
-- 创建临时表存储消息和会话的映射关系
CREATE TEMPORARY TABLE temp_message_conversation AS
SELECT
    m.id AS message_id,
    COALESCE(
        CASE
            WHEN c.participant1_id < c.participant2_id THEN c.participant1_id
            ELSE c.participant2_id
        END,
        m.sender_id
    ) AS assumed_coach_id,
    COALESCE(
        CASE
            WHEN m.sender_id = c.participant1_id THEN c.participant2_id
            WHEN m.sender_id = c.participant2_id THEN c.participant1_id
            ELSE NULL
        END,
        m.receiver_id
    ) AS assumed_student_id
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id;

-- === 第二步：修改 messages 表结构 ===

-- 1. 添加新字段
ALTER TABLE messages
ADD COLUMN coach_id BIGINT NULL COMMENT '教练ID' AFTER conversation_id,
ADD COLUMN student_id BIGINT NULL COMMENT '学员ID' AFTER coach_id;

-- 2. 从 conversations 表恢复数据到新字段
UPDATE messages m
INNER JOIN conversations c ON m.conversation_id = c.id
SET
    m.coach_id = CASE WHEN c.participant1_id < c.participant2_id THEN c.participant1_id ELSE c.participant2_id END,
    m.student_id = CASE WHEN m.sender_id = c.participant1_id THEN c.participant2_id ELSE c.participant1_id END;

-- 3. 如果没有对应的 conversation（异常数据），尝试从消息本身推断
UPDATE messages
SET
    coach_id = LEAST(sender_id, receiver_id),
    student_id = GREATEST(sender_id, receiver_id)
WHERE coach_id IS NULL;

-- 4. 添加索引
ALTER TABLE messages
ADD INDEX idx_coach_student (coach_id, student_id),
ADD INDEX idx_student_coach (student_id, coach_id);

-- 5. 将新字段设为 NOT NULL
ALTER TABLE messages
MODIFY COLUMN coach_id BIGINT NOT NULL,
MODIFY COLUMN student_id BIGINT NOT NULL;

-- 6. 删除旧的 conversation_id 字段
ALTER TABLE messages
DROP COLUMN conversation_id;

-- === 第三步：删除 conversations 表 ===
DROP TABLE IF EXISTS conversations;

-- === 完成 ===
-- 现在 messages 表的结构：
-- - id, coach_id, student_id, sender_id, receiver_id, sender_name, receiver_name
-- - content, message_type, created_at, read_at
