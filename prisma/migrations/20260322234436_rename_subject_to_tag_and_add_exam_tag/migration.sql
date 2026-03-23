/*
  Warnings:

  - You are about to drop the `Subject` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubjectSubtotalGroup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `subject` on the `Exam` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Subject_name_key";

-- DropIndex
DROP INDEX "SubjectSubtotalGroup_subjectId_subtotalGroupId_key";

-- DropIndex
DROP INDEX "SubjectSubtotalGroup_subtotalGroupId_idx";

-- DropIndex
DROP INDEX "SubjectSubtotalGroup_subjectId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Subject";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SubjectSubtotalGroup";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TagSubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagId" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TagSubtotalGroup_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TagSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamTag_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Exam" ("createdAt", "description", "examDate", "examName", "id", "updatedAt") SELECT "createdAt", "description", "examDate", "examName", "id", "updatedAt" FROM "Exam";
DROP TABLE "Exam";
ALTER TABLE "new_Exam" RENAME TO "Exam";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "TagSubtotalGroup_tagId_idx" ON "TagSubtotalGroup"("tagId");

-- CreateIndex
CREATE INDEX "TagSubtotalGroup_subtotalGroupId_idx" ON "TagSubtotalGroup"("subtotalGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "TagSubtotalGroup_tagId_subtotalGroupId_key" ON "TagSubtotalGroup"("tagId", "subtotalGroupId");

-- CreateIndex
CREATE INDEX "ExamTag_examId_idx" ON "ExamTag"("examId");

-- CreateIndex
CREATE INDEX "ExamTag_tagId_idx" ON "ExamTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamTag_examId_tagId_key" ON "ExamTag"("examId", "tagId");
