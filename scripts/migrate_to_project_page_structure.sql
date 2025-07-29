-- 既存データを新しいProjectPage構造に移行

-- 1. MasterImageからProjectPageを作成
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
    createdAt,
    updatedAt
FROM MasterImage;

-- 2. MasterImageからPageImageを作成（マスター画像）
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
    mi.id,  -- 既存のMasterImage IDを使用
    pp.id as projectPageId,
    NULL as studentId,  -- マスター画像なのでNULL
    mi.path as imagePath,
    'MASTER' as imageType,
    mi.createdAt,
    mi.updatedAt
FROM MasterImage mi
JOIN ProjectPage pp ON mi.projectId = pp.projectId AND mi.pageNumber = pp.pageNumber;

-- 3. AnswerSheetからPageImageを作成（答案画像）
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
FROM AnswerSheet ans
JOIN ProjectPage pp ON ans.projectId = pp.projectId AND ans.pageNumber = pp.pageNumber
WHERE ans.studentId IS NOT NULL;

-- 4. AnswerSheetから新しいAnswerSheet_newを作成
INSERT INTO AnswerSheet_new (
    "id",
    "projectPageId",
    "studentId", 
    "createdAt",
    "updatedAt"
)
SELECT 
    ans.id,  -- 既存のAnswerSheet IDを保持
    pp.id as projectPageId,
    ans.studentId,
    ans.createdAt,
    ans.updatedAt
FROM AnswerSheet ans
JOIN ProjectPage pp ON ans.projectId = pp.projectId AND ans.pageNumber = pp.pageNumber;