-- QuestionScoreからPageImageとの直接関係を解消し、CropRegion経由でのアクセスに変更

-- 1. 新しいQuestionScoreテーブル構造を作成（PageImageとの直接関係を削除）
CREATE TABLE QuestionScore_clean (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,  -- CropRegionのみにリレーション
    "studentId" TEXT,              -- 採点対象の学生（nullable: マスター解答の場合）
    "score" REAL,
    "isCorrect" BOOLEAN,
    "partialScore" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "scoredByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionScore_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id")
);

-- 2. 既存データを移行（PageImageからstudentIdを抽出）
INSERT INTO QuestionScore_clean (
    "id",
    "cropRegionId",
    "studentId",
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
    qs.cropRegionId,
    pi.studentId,  -- PageImageからstudentIdを取得
    qs.score,
    qs.isCorrect, 
    qs.partialScore,
    qs.status,
    qs.scoredByUserId,
    qs.createdAt,
    qs.updatedAt
FROM QuestionScore qs
JOIN PageImage pi ON qs.pageImageId = pi.id;

-- 3. 古いQuestionScoreテーブルを削除
DROP TABLE QuestionScore;

-- 4. 新しいテーブルの名前を元に戻す
ALTER TABLE QuestionScore_clean RENAME TO QuestionScore;

-- 5. インデックスを作成
CREATE UNIQUE INDEX "QuestionScore_cropRegionId_studentId_scoredByUserId_key" ON "QuestionScore"("cropRegionId", "studentId", "scoredByUserId");
CREATE INDEX "QuestionScore_cropRegionId_idx" ON "QuestionScore"("cropRegionId");
CREATE INDEX "QuestionScore_studentId_idx" ON "QuestionScore"("studentId");
CREATE INDEX "QuestionScore_scoredByUserId_idx" ON "QuestionScore"("scoredByUserId");