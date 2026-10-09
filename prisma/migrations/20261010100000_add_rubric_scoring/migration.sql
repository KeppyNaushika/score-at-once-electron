-- ルーブリック採点（教員の層）の表と列を足す（docs/vlm-grading-design.md §4・§5-2）。
--
--   RubricItem                   設問ごとのルーブリック項目。採点者の間で共有する
--   RubricApplication            適用（QuestionScore × 項目。採点者ごと）
--   RubricAdviceCombination      助言を持つ項目が重なったときの決まり
--   RubricAdviceCombinationItem  組み合わせを作る項目
--   CropRegion.scoringMethod     採点方式（points / deduction / addition）。既定 points で、今の採点は変わらない
--   QuestionScore.overridesRubric    採点キーで付けた点が項目より優先している印。既定 false
--   DrawingAnnotation.isRubricAdvice 項目の助言から作った朱書きの印。既定 false
--
-- 新しい表と、既定値つきの列を足すだけで、既存の行の id・時刻・値には触らない
-- （docs/unified-archive-design.md §8）。一意制約は置かない（uuid 以外の値を unique にしない）。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。
CREATE TABLE "RubricItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "effectKind" TEXT NOT NULL,
    "pointDelta" DECIMAL,
    "setStatus" TEXT,
    "setScore" DECIMAL,
    "adviceText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricItem_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RubricItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RubricApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionScoreId" TEXT NOT NULL,
    "rubricItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricApplication_questionScoreId_fkey" FOREIGN KEY ("questionScoreId") REFERENCES "QuestionScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RubricApplication_rubricItemId_fkey" FOREIGN KEY ("rubricItemId") REFERENCES "RubricItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RubricAdviceCombination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "mergedText" TEXT NOT NULL DEFAULT '',
    "primaryRubricItemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricAdviceCombination_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RubricAdviceCombination_primaryRubricItemId_fkey" FOREIGN KEY ("primaryRubricItemId") REFERENCES "RubricItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RubricAdviceCombinationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "combinationId" TEXT NOT NULL,
    "rubricItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RubricAdviceCombinationItem_combinationId_fkey" FOREIGN KEY ("combinationId") REFERENCES "RubricAdviceCombination" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RubricAdviceCombinationItem_rubricItemId_fkey" FOREIGN KEY ("rubricItemId") REFERENCES "RubricItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RubricItem_cropRegionId_idx" ON "RubricItem"("cropRegionId");

-- CreateIndex
CREATE INDEX "RubricApplication_questionScoreId_idx" ON "RubricApplication"("questionScoreId");

-- CreateIndex
CREATE INDEX "RubricApplication_rubricItemId_idx" ON "RubricApplication"("rubricItemId");

-- CreateIndex
CREATE INDEX "RubricAdviceCombination_cropRegionId_idx" ON "RubricAdviceCombination"("cropRegionId");

-- CreateIndex
CREATE INDEX "RubricAdviceCombinationItem_combinationId_idx" ON "RubricAdviceCombinationItem"("combinationId");

-- CreateIndex
CREATE INDEX "RubricAdviceCombinationItem_rubricItemId_idx" ON "RubricAdviceCombinationItem"("rubricItemId");

-- AlterTable
ALTER TABLE "CropRegion" ADD COLUMN "scoringMethod" TEXT NOT NULL DEFAULT 'points';

-- AlterTable
ALTER TABLE "QuestionScore" ADD COLUMN "overridesRubric" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DrawingAnnotation" ADD COLUMN "isRubricAdvice" BOOLEAN NOT NULL DEFAULT false;
