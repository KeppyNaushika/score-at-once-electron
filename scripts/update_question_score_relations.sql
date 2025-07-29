-- QuestionScoreの関係を新しいAnswerSheetに更新

-- 1. 新しいQuestionScoreテーブル構造を作成
CREATE TABLE QuestionScore_new (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerSheetId" TEXT NOT NULL,  -- 新しいAnswerSheet_newを参照
    "cropRegionId" TEXT NOT NULL,
    "score" REAL,
    "isCorrect" BOOLEAN,
    "partialScore" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "scoredByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet_new" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id")
);

-- 2. 既存データを移行（AnswerSheetのIDは保持されているため、そのまま移行可能）
INSERT INTO QuestionScore_new (
    "id",
    "answerSheetId", 
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
    qs.answerSheetId,  -- IDは新しいAnswerSheet_newで保持されている
    qs.cropRegionId,
    qs.score,
    qs.isCorrect,
    qs.partialScore,
    qs.status,
    qs.scoredByUserId,
    qs.createdAt,
    qs.updatedAt
FROM QuestionScore qs
WHERE EXISTS (
    SELECT 1 FROM AnswerSheet_new ans WHERE ans.id = qs.answerSheetId
);

-- 3. 古いQuestionScoreテーブルを削除
DROP TABLE QuestionScore;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE QuestionScore_new RENAME TO QuestionScore;

-- 5. インデックスを作成
CREATE UNIQUE INDEX "QuestionScore_answerSheetId_cropRegionId_scoredByUserId_key" ON "QuestionScore"("answerSheetId", "cropRegionId", "scoredByUserId");
CREATE INDEX "QuestionScore_answerSheetId_idx" ON "QuestionScore"("answerSheetId");
CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");
CREATE INDEX "QuestionScore_scoredByUserId_idx" ON "QuestionScore"("scoredByUserId");