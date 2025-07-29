-- Project-SubtotalGroup関係を多対多テーブルに移行

-- 1. 既存のSubtotalGroup.projectIdをProjectSubtotalGroupテーブルに移行
INSERT INTO ProjectSubtotalGroup (
    "id",
    "projectId",
    "subtotalGroupId", 
    "createdAt",
    "updatedAt"
)
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    projectId,
    id as subtotalGroupId,
    createdAt,
    updatedAt
FROM SubtotalGroup
WHERE projectId IS NOT NULL;