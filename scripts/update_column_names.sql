-- QuestionScore テーブルの layoutRegionId を cropRegionId に変更

-- 1. 新しいテーブル構造を作成
CREATE TABLE QuestionScore_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT,
    "answerSheetId" TEXT NOT NULL,
    "cropRegionId" TEXT NOT NULL,  -- layoutRegionId から変更
    "partialScore" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 2. データをコピー（列名を変更してコピー）
INSERT INTO QuestionScore_new 
SELECT 
    id,
    questionId,
    answerSheetId,
    layoutRegionId as cropRegionId,  -- 列名を変更してコピー
    partialScore,
    comment,
    scoredByUserId,
    status,
    createdAt,
    updatedAt,
    version
FROM QuestionScore;

-- 3. 古いテーブルを削除
DROP TABLE QuestionScore;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE QuestionScore_new RENAME TO QuestionScore;

-- 5. インデックスを再作成
CREATE UNIQUE INDEX "QuestionScore_answerSheetId_cropRegionId_scoredByUserId_key" ON "QuestionScore"("answerSheetId", "cropRegionId", "scoredByUserId");
CREATE INDEX "QuestionScore_answerSheetId_idx" ON "QuestionScore"("answerSheetId");
CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");
CREATE INDEX "QuestionScore_scoredByUserId_idx" ON "QuestionScore"("scoredByUserId");