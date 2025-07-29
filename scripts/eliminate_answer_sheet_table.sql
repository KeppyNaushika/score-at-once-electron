-- AnswerSheetテーブルを完全に削除し、QuestionScoreをPageImageに直接関連付け

-- 1. 新しいQuestionScoreテーブル構造を作成（PageImageに直接関連付け）
CREATE TABLE QuestionScore_final (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageImageId" TEXT NOT NULL,  -- AnswerSheetIdからPageImageIdに変更
    "cropRegionId" TEXT NOT NULL,
    "score" REAL,
    "isCorrect" BOOLEAN,
    "partialScore" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "scoredByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionScore_pageImageId_fkey" FOREIGN KEY ("pageImageId") REFERENCES "PageImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id")
);

-- 2. 既存データを移行（AnswerSheetからPageImageへの変換）
INSERT INTO QuestionScore_final (
    "id",
    "pageImageId",
    "cropRegionId", 
    "score",
    "isCorrect",
    "partialScore",
    "status",
    "scoredByUserId",
    "createdAt",
    "updatedAt"
)
SELECT 
    qs.id,
    pi.id as pageImageId,  -- AnswerSheetからPageImageに変換
    qs.cropRegionId,
    qs.score,
    qs.isCorrect, 
    qs.partialScore,
    qs.status,
    qs.scoredByUserId,
    qs.createdAt,
    qs.updatedAt
FROM QuestionScore qs
JOIN AnswerSheet ans ON qs.answerSheetId = ans.id
JOIN PageImage pi ON ans.projectPageId = pi.projectPageId AND ans.studentId = pi.studentId
WHERE pi.imageType = 'ANSWER';

-- 3. 古いQuestionScoreテーブルを削除
DROP TABLE QuestionScore;

-- 4. AnswerSheetテーブルを削除
DROP TABLE AnswerSheet;

-- 5. 新しいQuestionScoreテーブルの名前を元に戻す
ALTER TABLE QuestionScore_final RENAME TO QuestionScore;

-- 6. インデックスを作成
CREATE UNIQUE INDEX "QuestionScore_pageImageId_cropRegionId_scoredByUserId_key" ON "QuestionScore"("pageImageId", "cropRegionId", "scoredByUserId");
CREATE INDEX "QuestionScore_pageImageId_idx" ON "QuestionScore"("pageImageId");
CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");
CREATE INDEX "QuestionScore_scoredByUserId_idx" ON "QuestionScore"("scoredByUserId");