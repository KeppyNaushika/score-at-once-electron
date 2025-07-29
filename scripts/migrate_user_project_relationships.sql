-- 既存のProject.userIdをUserProjectテーブルに移行

-- 1. 既存のProject-User関係をUserProjectテーブルに移行
INSERT INTO UserProject (
    "id",
    "userId", 
    "projectId",
    "role",
    "createdAt",
    "updatedAt"
)
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    userId,
    id as projectId,
    'OWNER' as role,  -- 元の作成者はOWNERロール
    createdAt,
    updatedAt
FROM Project
WHERE userId IS NOT NULL;