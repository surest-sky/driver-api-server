-- 添加 coach_id 字段到 messages 表
-- 用于优化教练端查询性能，直接通过 coach_id 获取消息

-- 1. 添加 coach_id 字段
ALTER TABLE messages
ADD COLUMN coach_id BIGINT NULL COMMENT '教练ID，冗余字段方便查询'
AFTER conversation_id;

-- 2. 添加索引以优化查询性能
ALTER TABLE messages
ADD INDEX idx_coach_id (coach_id);

-- 3. 添加复合索引以优化教练查询特定学员的消息
ALTER TABLE messages
ADD INDEX idx_coach_student (coach_id, receiver_id);

-- 4. 更新现有数据：将 conversation_id 作为 coach_id（假设 conversation_id 就是 coach_id）
UPDATE messages m
INNER JOIN conversations c ON m.conversation_id = c.id
SET m.coach_id = c.participant1_id
WHERE m.coach_id IS NULL;

-- 5. 将 coach_id 改为 NOT NULL（数据迁移完成后）
-- 注意：如果前面的 UPDATE 没有覆盖所有记录，需要先检查是否有 NULL 值
-- ALTER TABLE messages MODIFY COLUMN coach_id BIGINT NOT NULL;
