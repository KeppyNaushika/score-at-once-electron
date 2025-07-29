-- 新しいテーブルをクリアして重複排除で再移行

-- 1. 新しいテーブルをクリア
DELETE FROM AnswerSheet_new;
DELETE FROM PageImage;
DELETE FROM ProjectPage;

-- 2. MasterImageからProjectPageを作成（重複排除）
INSERT INTO ProjectPage (
    "id",
    "projectId", 
    "pageNumber",
    "createdAt",
    "updatedAt"
)
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    projectId,
    pageNumber,
    MIN(createdAt) as createdAt,  -- 最初の作成日時を使用
    MAX(updatedAt) as updatedAt   -- 最新の更新日時を使用  
FROM MasterImage
GROUP BY projectId, pageNumber;  -- 重複排除

-- 3. MasterImageからPageImageを作成（マスター画像、重複排除）
INSERT INTO PageImage (
    "id",
    "projectPageId",
    "studentId",
    "imagePath", 
    "imageType",
    "createdAt",
    "updatedAt"
)
SELECT 
    mi.id,  -- 最初のMasterImage IDを使用
    pp.id as projectPageId,
    NULL as studentId,
    mi.path as imagePath,
    'MASTER' as imageType,
    mi.createdAt,
    mi.updatedAt
FROM (
    SELECT id, projectId, pageNumber, path, createdAt, updatedAt,
           ROW_NUMBER() OVER (PARTITION BY projectId, pageNumber ORDER BY createdAt) as rn
    FROM MasterImage
) mi
JOIN ProjectPage pp ON mi.projectId = pp.projectId AND mi.pageNumber = pp.pageNumber
WHERE mi.rn = 1;  -- 最初のレコードのみ使用

-- 4. AnswerSheetからPageImageを作成（答案画像、重複排除）
INSERT INTO PageImage (
    "id",
    "projectPageId", 
    "studentId",
    "imagePath",
    "imageType",
    "createdAt",
    "updatedAt"
)
SELECT 
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || substr(hex(randomblob(2)), 2) || '-' || substr('AB89', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) as id,
    pp.id as projectPageId,
    ans.studentId,
    ans.originalImagePath as imagePath,
    'ANSWER' as imageType,
    ans.createdAt,
    ans.updatedAt
FROM (
    SELECT projectId, pageNumber, studentId, originalImagePath, createdAt, updatedAt,
           ROW_NUMBER() OVER (PARTITION BY projectId, pageNumber, studentId ORDER BY createdAt) as rn
    FROM AnswerSheet
    WHERE studentId IS NOT NULL
) ans
JOIN ProjectPage pp ON ans.projectId = pp.projectId AND ans.pageNumber = pp.pageNumber
WHERE ans.rn = 1;  -- 最初のレコードのみ使用

-- 5. AnswerSheetから新しいAnswerSheet_newを作成（重複排除）
INSERT INTO AnswerSheet_new (
    "id",
    "projectPageId",
    "studentId", 
    "createdAt",
    "updatedAt"
)
SELECT 
    ans.id,
    pp.id as projectPageId,
    ans.studentId,
    ans.createdAt,
    ans.updatedAt
FROM (
    SELECT id, projectId, pageNumber, studentId, createdAt, updatedAt,
           ROW_NUMBER() OVER (PARTITION BY projectId, pageNumber, studentId ORDER BY createdAt) as rn
    FROM AnswerSheet
) ans
JOIN ProjectPage pp ON ans.projectId = pp.projectId AND ans.pageNumber = pp.pageNumber
WHERE ans.rn = 1;  -- 最初のレコードのみ使用