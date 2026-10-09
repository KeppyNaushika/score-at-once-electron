-- 成績算出の出力（Excel「成績一覧」・個人成績通知書）に比較を載せる。
--
-- 1. 出力で使う比較の選択を置く表を作る（成績算出 × 比較）。行が無い比較は出す（アプリの
--    既定）ので、既存の比較から行を作る必要は無い。外したときだけ enabled = false の行ができる。
--    id は uuidv4 で、同定は (gradeId, gradeComparisonId) の一意制約で行う。
--    成績算出・比較のどちらが消えても選択は意味を失うので、両方ともカスケードで消す。
-- 2. 個人成績通知書の「評価」に比較の記号を続けて出すかの列を足す。既定は OFF で、
--    既存の通知書の見た目は変わらない。
--
-- 新しい表と列を足すだけで、既存の行の id・時刻・値には触らない（docs/unified-archive-design.md §8）。
CREATE TABLE "GradeExportComparison" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "gradeComparisonId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeExportComparison_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeExportComparison_gradeComparisonId_fkey" FOREIGN KEY ("gradeComparisonId") REFERENCES "GradeComparison" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeExportComparison_gradeId_gradeComparisonId_key" ON "GradeExportComparison"("gradeId", "gradeComparisonId");

-- CreateIndex
CREATE INDEX "GradeExportComparison_gradeComparisonId_idx" ON "GradeExportComparison"("gradeComparisonId");

-- AlterTable
ALTER TABLE "GradeIndividualReportSettings" ADD COLUMN "itemGradeComparisonMarks" BOOLEAN NOT NULL DEFAULT false;
