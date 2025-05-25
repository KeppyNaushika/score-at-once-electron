/*
  Warnings:

  - You are about to drop the column `scoreDisplayAreas` on the `ExamTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `templateData` on the `ExamTemplate` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "TemplateArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examTemplateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "label" TEXT,
    "questionNumber" TEXT,
    "points" REAL,
    "sourceAreaIdsJson" TEXT,
    "sourceQuestionNumbersJson" TEXT,
    "displayOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TemplateArea_examTemplateId_fkey" FOREIGN KEY ("examTemplateId") REFERENCES "ExamTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExamTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "ExamTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExamTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExamTemplate" ("createdAt", "createdById", "description", "id", "name", "projectId", "updatedAt") SELECT "createdAt", "createdById", "description", "id", "name", "projectId", "updatedAt" FROM "ExamTemplate";
DROP TABLE "ExamTemplate";
ALTER TABLE "new_ExamTemplate" RENAME TO "ExamTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TemplateArea_examTemplateId_idx" ON "TemplateArea"("examTemplateId");
