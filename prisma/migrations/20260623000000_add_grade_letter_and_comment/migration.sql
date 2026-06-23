-- AlterTable: GradeDataSource に文字評価入力モードを追加
ALTER TABLE "GradeDataSource" ADD COLUMN "inputMode" TEXT NOT NULL DEFAULT 'numeric';

-- AlterTable: ManualScore に文字評価・加減点・コメントを追加（全てデータソース×生徒単位）
ALTER TABLE "ManualScore" ADD COLUMN "letterValue" TEXT;
ALTER TABLE "ManualScore" ADD COLUMN "adjustment" DECIMAL DEFAULT 0;
ALTER TABLE "ManualScore" ADD COLUMN "adjustmentReason" TEXT;
ALTER TABLE "ManualScore" ADD COLUMN "comment" TEXT;

-- CreateTable: 文字評価→点数の変換表（manual型データソース単位。例: A=100, B=80, C=60）
CREATE TABLE "GradeLetterScale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeDataSourceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeLetterScale_gradeDataSourceId_fkey" FOREIGN KEY ("gradeDataSourceId") REFERENCES "GradeDataSource" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeLetterScale_gradeDataSourceId_label_key" ON "GradeLetterScale"("gradeDataSourceId", "label");

-- CreateIndex
CREATE INDEX "GradeLetterScale_gradeDataSourceId_idx" ON "GradeLetterScale"("gradeDataSourceId");
