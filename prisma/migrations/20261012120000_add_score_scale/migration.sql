-- 段階評価（A/B/C）の表と列を足す（docs/vlm-grading-design.md §4-8-3・§4-8-8）。
--
--   ScoreScale                     ルーブリック（段階の組）。examId が null なら共通、値があればその試験だけ。
--                                  試験が消えたら試験のものだけが消える（共通のものは examId が null なので残る）
--   ScoreScaleLevel                段階（記号・記述語・配点に掛ける割合）。組とともに消える
--   CropRegion.scoreScaleId        段階評価の設問で使う組。組が消えたら null
--   QuestionScore.scaleLevelId     付けた段階。段階が消えたら null
--   ScoreDecision.scaleLevelId     確定した段階。段階が消えたら null
--   RubricItem.setScaleLevelId     当たったらその段階にする項目の段階。段階が消えたら null
--   ExamIndividualReportSettings.scaleValueDisplay   段階の見せ方（既定 label_points ＝「A (8)」）
--   GradeIndividualReportSettings.scaleValueDisplay  同上
--
-- 新しい表と、外部キーつきの nullable な列・既定値つきの列を足すだけ（既定は NULL か既定値なので
-- ALTER TABLE … ADD COLUMN で足せる）。既存の行の id・時刻・値には触らない
-- （docs/unified-archive-design.md §8 の規約1）。一意制約は置かない（uuid 以外の値を unique にしない）。
-- 外部キーの ON UPDATE は schema.prisma で onUpdate を書いていないので、Prisma の既定の CASCADE。

-- CreateTable
CREATE TABLE "ScoreScale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreScale_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreScaleLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scaleId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "ratio" DECIMAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreScaleLevel_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "ScoreScale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "CropRegion" ADD COLUMN "scoreScaleId" TEXT REFERENCES "ScoreScale" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "QuestionScore" ADD COLUMN "scaleLevelId" TEXT REFERENCES "ScoreScaleLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ScoreDecision" ADD COLUMN "scaleLevelId" TEXT REFERENCES "ScoreScaleLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "RubricItem" ADD COLUMN "setScaleLevelId" TEXT REFERENCES "ScoreScaleLevel" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ExamIndividualReportSettings" ADD COLUMN "scaleValueDisplay" TEXT NOT NULL DEFAULT 'label_points';

-- AlterTable
ALTER TABLE "GradeIndividualReportSettings" ADD COLUMN "scaleValueDisplay" TEXT NOT NULL DEFAULT 'label_points';

-- CreateIndex
CREATE INDEX "ScoreScale_examId_idx" ON "ScoreScale"("examId");

-- CreateIndex
CREATE INDEX "ScoreScaleLevel_scaleId_idx" ON "ScoreScaleLevel"("scaleId");

-- CreateIndex
CREATE INDEX "CropRegion_scoreScaleId_idx" ON "CropRegion"("scoreScaleId");

-- CreateIndex
CREATE INDEX "QuestionScore_scaleLevelId_idx" ON "QuestionScore"("scaleLevelId");

-- CreateIndex
CREATE INDEX "ScoreDecision_scaleLevelId_idx" ON "ScoreDecision"("scaleLevelId");

-- CreateIndex
CREATE INDEX "RubricItem_setScaleLevelId_idx" ON "RubricItem"("setScaleLevelId");
