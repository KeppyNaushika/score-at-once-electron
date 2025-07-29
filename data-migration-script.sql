-- データ移行スクリプト
-- 実行前にバックアップを必ず取得すること

-- 1. 新しいテーブル作成後のデータ移行

-- CropRegion にLayoutRegionのデータを移行
INSERT INTO CropRegion (
  id, projectId, masterImageId, label, type, 
  x, y, width, height, points, orderIndex, 
  createdAt, updatedAt
)
SELECT 
  id, projectId, masterImageId, label, type,
  x, y, width, height, points, orderIndex,
  createdAt, updatedAt
FROM LayoutRegion;

-- SubtotalGroup にQuestionGroupのデータを移行
INSERT INTO SubtotalGroup (
  id, name, projectId, description, createdAt, updatedAt
)
SELECT 
  id, name, projectId, NULL as description, createdAt, updatedAt
FROM QuestionGroup;

-- Subtotal にQuestionGroupItemのデータを移行
INSERT INTO Subtotal (
  id, name, subtotalGroupId, "order", createdAt, updatedAt
)
SELECT 
  id, name, questionGroupId, "order", createdAt, updatedAt
FROM QuestionGroupItem;

-- CropSubtotal にSubtotalDefinitionのデータを移行
INSERT INTO CropSubtotal (
  id, cropRegionId, subtotalId, assignmentType, createdAt, updatedAt
)
SELECT 
  id, layoutRegionId, questionGroupItemId, 'SUBTOTAL_DEFINITION', createdAt, updatedAt
FROM SubtotalDefinition;

-- CropSubtotal にQuestionSubtotalAssignmentのデータを移行
INSERT INTO CropSubtotal (
  id, cropRegionId, subtotalId, assignmentType, createdAt, updatedAt
)
SELECT 
  id, questionLayoutRegionId, questionGroupItemId, 'QUESTION_ASSIGNMENT', createdAt, updatedAt
FROM QuestionSubtotalAssignment;

-- QuestionScore のlayoutRegionIdをcropRegionIdに更新
UPDATE QuestionScore 
SET cropRegionId = layoutRegionId 
WHERE layoutRegionId IS NOT NULL;

-- UserProject に既存のProject-Userの関係を移行
INSERT INTO UserProject (
  id, userId, projectId, role, joinedAt, createdAt, updatedAt
)
SELECT 
  REPLACE(LOWER(HEX(RANDOMBLOB(16))), '-', ''), -- Generate UUID
  userId, 
  id as projectId, 
  'OWNER', 
  createdAt, 
  createdAt, 
  updatedAt
FROM Project;

-- ProjectSubtotalGroup に既存のProject-SubtotalGroupの関係を移行
INSERT INTO ProjectSubtotalGroup (
  id, projectId, subtotalGroupId, "order", isActive, createdAt, updatedAt
)
SELECT 
  REPLACE(LOWER(HEX(RANDOMBLOB(16))), '-', ''), -- Generate UUID
  projectId, 
  id as subtotalGroupId, 
  0, 
  true, 
  createdAt, 
  updatedAt
FROM SubtotalGroup
WHERE projectId IS NOT NULL;