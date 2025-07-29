-- SubtotalDefinition と QuestionSubtotalAssignment のデータを CropSubtotal に統合

-- 1. SubtotalDefinition のデータを統合（assignmentType = 'SUBTOTAL_DEFINITION'）
INSERT INTO CropSubtotal (
    "id",
    "cropRegionId", 
    "subtotalId",
    "assignmentType",
    "createdAt",
    "updatedAt"
)
SELECT 
    id,
    cropRegionId,
    subtotalId,
    'SUBTOTAL_DEFINITION' as assignmentType,
    createdAt,
    updatedAt
FROM SubtotalDefinition;

-- 2. QuestionSubtotalAssignment のデータを統合（assignmentType = 'QUESTION_ASSIGNMENT'）
INSERT INTO CropSubtotal (
    "id",
    "cropRegionId",
    "subtotalId", 
    "assignmentType",
    "createdAt",
    "updatedAt"
)
SELECT 
    id,
    cropRegionId,
    subtotalId,
    'QUESTION_ASSIGNMENT' as assignmentType,
    createdAt,
    updatedAt
FROM QuestionSubtotalAssignment;