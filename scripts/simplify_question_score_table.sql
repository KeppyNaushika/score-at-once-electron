-- QuestionScoreテーブルを簡素化（isCorrectとscoreフィールドを削除）

-- 1. 新しい簡素化されたQuestionScoreテーブルを作成
CREATE TABLE QuestionScore_simplified (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "studentId" TEXT,
    "partialScore" DECIMAL,  -- 実際のスコア値（NULL=未採点）
    "status" TEXT NOT NULL DEFAULT 'unscored',  -- unscored, correct, incorrect, partial, no_answer
    "scoredByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id")
);

-- 2. 既存データを移行（isCorrectとscoreを除外）
INSERT INTO QuestionScore_simplified (
    "id",
    "cropRegionId",
    "studentId",
    "partialScore",
    "status",
    "scoredByUserId",
    "createdAt",
    "updatedAt"
)
SELECT 
    id,
    cropRegionId,
    studentId,
    partialScore,
    status,
    scoredByUserId,
    createdAt,
    updatedAt
FROM QuestionScore;

-- 3. 古いQuestionScoreテーブルを削除
DROP TABLE QuestionScore;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE QuestionScore_simplified RENAME TO QuestionScore;

-- 5. インデックスを作成
CREATE UNIQUE INDEX "QuestionScore_cropRegionId_studentId_scoredByUserId_key" ON "QuestionScore"("cropRegionId", "studentId", "scoredByUserId");
CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");
CREATE INDEX "QuestionScore_studentId_idx" ON "QuestionScore"("studentId");
CREATE INDEX "QuestionScore_scoredByUserId_idx" ON "QuestionScore"("scoredByUserId");