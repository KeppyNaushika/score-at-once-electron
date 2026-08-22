-- *Id を名乗りながら外部キーを持たない列のうち、実際に行を指している2件を片付ける。
--
-- 1) ScoreDecision.sourceQuestionScoreId は列ごと落とす。
--    誰の採点結果を採用しているのかは、そもそも決まらない。2人が同じ「正答」を
--    付けていたら、どちらを採用したのか・両方なのかは記録のしようがない。
--    保存すべきは採点結果であって、由来ではない。
--    verdict / score / comment / decidedByUserId で確定は完結している。
--    採用元に紐づけて印刷していた手書き注釈は、当面そのセルの注釈をすべて表示する。
--
-- 2) ReturnSnapshot.capturedByUserId には User への外部キーを張る（ON DELETE CASCADE）。
--    利用者を消したら、その人が記録した返却版も消える。
--
-- 張らずに残す4件（意図であって漏れではない）:
--    AuditLog.userId   — 利用者を消した後もログを残すため
--    AuditLog.scopeId / entityId — 指す先のテーブルが行ごとに変わる多態参照で張れない
--    UserSidePanelSection.sectionId — UI 側の固定値で、どの行も指していない
--
-- 外部キーを張る前に、参照先を失った値を掃除しておく。migrationDeployer は各
-- マイグレーションを foreign_keys=OFF で開始するので既存行は検証されず、掃除を
-- 省くと「外部キーがあるのに違反した行が残る」状態になる。牙を剥くのは次に
-- 外部キーが効く経路（同期の適用）で、そのときには原因が遠くなっている。

-- ── 1. ぶら下がりの掃除（参照先の消えた操作者を「システム操作」へ倒す） ──
UPDATE "ReturnSnapshot"
SET "capturedByUserId" = NULL
WHERE "capturedByUserId" IS NOT NULL
  AND "capturedByUserId" NOT IN (SELECT "id" FROM "User");

-- ── 2. テーブルの作り直し ──
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ScoreDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "examStudentId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" DECIMAL,
    "comment" TEXT,
    "decidedByUserId" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreDecision_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ScoreDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

INSERT INTO "new_ScoreDecision" ("id", "cropRegionId", "examStudentId", "verdict", "score", "comment", "decidedByUserId", "decidedAt", "createdAt", "updatedAt")
SELECT "id", "cropRegionId", "examStudentId", "verdict", "score", "comment", "decidedByUserId", "decidedAt", "createdAt", "updatedAt"
FROM "ScoreDecision";

DROP TABLE "ScoreDecision";
ALTER TABLE "new_ScoreDecision" RENAME TO "ScoreDecision";

CREATE UNIQUE INDEX "ScoreDecision_cropRegionId_examStudentId_key" ON "ScoreDecision"("cropRegionId", "examStudentId");
CREATE INDEX "ScoreDecision_examStudentId_idx" ON "ScoreDecision"("examStudentId");

CREATE TABLE "new_ReturnSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examStudentId" TEXT NOT NULL,
    "scoresJson" TEXT NOT NULL,
    "totalScore" DECIMAL,
    "capturedByUserId" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnSnapshot_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ReturnSnapshot_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

INSERT INTO "new_ReturnSnapshot" ("id", "examStudentId", "scoresJson", "totalScore", "capturedByUserId", "capturedAt", "createdAt", "updatedAt")
SELECT "id", "examStudentId", "scoresJson", "totalScore", "capturedByUserId", "capturedAt", "createdAt", "updatedAt"
FROM "ReturnSnapshot";

DROP TABLE "ReturnSnapshot";
ALTER TABLE "new_ReturnSnapshot" RENAME TO "ReturnSnapshot";

CREATE UNIQUE INDEX "ReturnSnapshot_examStudentId_key" ON "ReturnSnapshot"("examStudentId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
