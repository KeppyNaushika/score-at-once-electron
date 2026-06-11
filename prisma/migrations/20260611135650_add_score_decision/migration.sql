-- CreateTable
CREATE TABLE "ScoreDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" DECIMAL,
    "comment" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceQuestionScoreId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreDecision_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateIndex
CREATE INDEX "ScoreDecision_studentId_idx" ON "ScoreDecision"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreDecision_cropRegionId_studentId_key" ON "ScoreDecision"("cropRegionId", "studentId");

-- ============================================================
-- データ変換: 旧 status="final"/"proposed" の廃止
-- 各クライアントのローカルDBで同一の決定的変換が行われるよう、
-- ScoreDecision.id には final 行の id を流用する（final 行は同期済みのため
-- 全クライアントで同一 id となり、同期後も単一行に収束する）。
-- ============================================================

-- 1) 生徒×設問ごとに最新の final 行から確定（ScoreDecision）を生成
INSERT INTO "ScoreDecision" ("id", "cropRegionId", "studentId", "verdict", "score", "decidedByUserId", "decidedAt", "createdAt", "updatedAt")
SELECT qs."id", qs."cropRegionId", qs."studentId",
       CASE WHEN qs."partialScore" IS NULL THEN 'correct' ELSE 'partial' END,
       qs."partialScore", qs."userId", qs."updatedAt", qs."createdAt", qs."updatedAt"
FROM "QuestionScore" qs
WHERE qs."status" = 'final'
  AND qs."id" = (
    SELECT q2."id" FROM "QuestionScore" q2
    WHERE q2."cropRegionId" = qs."cropRegionId"
      AND q2."studentId" = qs."studentId"
      AND q2."status" = 'final'
    ORDER BY q2."updatedAt" DESC, q2."id" DESC
    LIMIT 1
  );

-- 2) final 行の描画注釈を、同じ採点者の既存提案行へ移す（提案行がある場合のみ）
UPDATE "DrawingAnnotation"
SET "questionScoreId" = COALESCE(
  (
    SELECT p."id" FROM "QuestionScore" p, "QuestionScore" f
    WHERE f."id" = "DrawingAnnotation"."questionScoreId"
      AND p."cropRegionId" = f."cropRegionId"
      AND p."studentId" = f."studentId"
      AND p."userId" = f."userId"
      AND p."status" != 'final'
      AND p."id" != f."id"
    ORDER BY p."updatedAt" DESC, p."id" DESC
    LIMIT 1
  ),
  "questionScoreId"
)
WHERE "questionScoreId" IN (SELECT "id" FROM "QuestionScore" WHERE "status" = 'final');

-- 3) 同じ採点者の提案行が既にある final 行は削除（注釈は手順2で移動済み）
DELETE FROM "QuestionScore"
WHERE "status" = 'final'
  AND EXISTS (
    SELECT 1 FROM "QuestionScore" p
    WHERE p."cropRegionId" = "QuestionScore"."cropRegionId"
      AND p."studentId" = "QuestionScore"."studentId"
      AND p."userId" = "QuestionScore"."userId"
      AND p."status" != 'final'
      AND p."id" != "QuestionScore"."id"
  );

-- 4) 残りの final 行を採点判定のみの提案行へ変換（status 浄化）
UPDATE "QuestionScore"
SET "status" = CASE WHEN "partialScore" IS NULL THEN 'correct' ELSE 'partial' END
WHERE "status" = 'final';

-- 5) proposed の浄化（点数ありは partial、点数なしは pending へ）
UPDATE "QuestionScore"
SET "status" = CASE WHEN "partialScore" IS NULL THEN 'pending' ELSE 'partial' END
WHERE "status" = 'proposed';
