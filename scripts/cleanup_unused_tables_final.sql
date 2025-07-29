-- CropSubtotal統合完了後、古いテーブルを削除

-- 1. SubtotalDefinition テーブルを削除（CropSubtotalに統合済み）
DROP TABLE SubtotalDefinition;

-- 2. QuestionSubtotalAssignment テーブルを削除（CropSubtotalに統合済み）
DROP TABLE QuestionSubtotalAssignment;