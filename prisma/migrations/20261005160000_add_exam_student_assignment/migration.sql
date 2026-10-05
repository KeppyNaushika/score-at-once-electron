-- CreateTable: 受験生徒ごとの採点担当（docs/scoring-scope-and-permissions-design.md §3-1）。
-- 設問ごとの担当（CropRegionAssignment）と対等な軸で、作りも揃える。
-- id は uuidv4 で、同定は (examStudentId, userId) の一意制約で行う。
--
-- 新しい表を作るだけで、既存の行には触らない（docs/unified-archive-design.md §8）。
CREATE TABLE "ExamStudentAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examStudentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamStudentAssignment_examStudentId_fkey" FOREIGN KEY ("examStudentId") REFERENCES "ExamStudent" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ExamStudentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ExamStudentAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamStudentAssignment_examStudentId_userId_key" ON "ExamStudentAssignment"("examStudentId", "userId");

-- CreateIndex
CREATE INDEX "ExamStudentAssignment_userId_idx" ON "ExamStudentAssignment"("userId");
