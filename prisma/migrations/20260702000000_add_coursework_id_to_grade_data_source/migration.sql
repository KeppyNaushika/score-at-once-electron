-- AlterTable: GradeDataSource に試験外成績資料（Coursework）全体への参照を追加
-- （courseworkItemId は評価項目単位、courseworkId は資料全体を参照する coursework_total 型用）
ALTER TABLE "GradeDataSource" ADD COLUMN "courseworkId" TEXT;

-- CreateIndex
CREATE INDEX "GradeDataSource_courseworkId_idx" ON "GradeDataSource"("courseworkId");
