-- 未使用テーブル・フィールド削除スクリプト
-- 作成日: 2025-01-29
-- 目的: Question系未使用テーブルと_ClassTeachersテーブル、QuestionScore.questionIdフィールドの削除

-- バックアップ確認用クエリ（実行前に確認）
-- SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

BEGIN TRANSACTION;

-- 1. QuestionPartScoreテーブル削除（最も依存されているテーブルから）
DROP TABLE IF EXISTS "QuestionPartScore";

-- 2. QuestionPartテーブル削除
DROP TABLE IF EXISTS "QuestionPart";

-- 3. Questionテーブル削除
DROP TABLE IF EXISTS "Question";

-- 4. _ClassTeachersテーブル削除
DROP TABLE IF EXISTS "_ClassTeachers";

-- 5. QuestionScore.questionIdフィールド削除
-- SQLiteではALTER TABLE DROP COLUMNが制限されているため、テーブル再作成で対応

-- 5.1 新しいQuestionScoreテーブル作成（questionIdフィールドなし）
CREATE TABLE "QuestionScore_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerSheetId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5.2 データの移行（questionIdは除外）
INSERT INTO "QuestionScore_new" (
    "id", "answerSheetId", "layoutRegionId", "partialScore", "comment", 
    "scoredByUserId", "status", "createdAt", "updatedAt", "scoreVersion"
)
SELECT 
    "id", "answerSheetId", "layoutRegionId", "partialScore", "comment",
    "scoredByUserId", "status", "createdAt", "updatedAt", "scoreVersion"
FROM "QuestionScore";

-- 5.3 古いテーブル削除
DROP TABLE "QuestionScore";

-- 5.4 新しいテーブルの名前を変更
ALTER TABLE "QuestionScore_new" RENAME TO "QuestionScore";

-- 5.5 インデックス再作成
CREATE UNIQUE INDEX "QuestionScore_answerSheetId_layoutRegionId_scoredByUserId_key" ON "QuestionScore"("answerSheetId", "layoutRegionId", "scoredByUserId");
CREATE INDEX "QuestionScore_answerSheetId_layoutRegionId_status_idx" ON "QuestionScore"("answerSheetId", "layoutRegionId", "status");
CREATE INDEX "QuestionScore_layoutRegionId_idx" ON "QuestionScore"("layoutRegionId");

-- 削除完了確認用クエリ
-- SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Question', 'QuestionPart', 'QuestionPartScore', '_ClassTeachers') ORDER BY name;

COMMIT;