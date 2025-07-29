-- 古いテーブルを削除し、新しい構造を確定

-- 1. 古いMasterImageテーブルを削除
DROP TABLE MasterImage;

-- 2. 古いAnswerSheetテーブルを削除
DROP TABLE AnswerSheet;

-- 3. 新しいAnswerSheetテーブルの名前を正式にする
ALTER TABLE AnswerSheet_new RENAME TO AnswerSheet;