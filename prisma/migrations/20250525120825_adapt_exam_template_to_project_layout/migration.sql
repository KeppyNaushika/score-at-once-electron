/*
  Warnings:

  - You are about to drop the column `description` on the `ExamTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `ExamTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `answerArea` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `questionNumber` on the `TemplateArea` table. All the data in the column will be lost.
  - Made the column `projectId` on table `ExamTemplate` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExamTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "ExamTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExamTemplate" ("createdAt", "createdById", "id", "projectId", "updatedAt") SELECT "createdAt", "createdById", "id", "projectId", "updatedAt" FROM "ExamTemplate";
DROP TABLE "ExamTemplate";
ALTER TABLE "new_ExamTemplate" RENAME TO "ExamTemplate";
CREATE UNIQUE INDEX "ExamTemplate_projectId_key" ON "ExamTemplate"("projectId");
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "points" REAL NOT NULL,
    "questionType" TEXT NOT NULL,
    "correctAnswer" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("correctAnswer", "createdAt", "id", "points", "projectId", "questionNumber", "questionType", "updatedAt") SELECT "correctAnswer", "createdAt", "id", "points", "projectId", "questionNumber", "questionType", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
CREATE TABLE "new_TemplateArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examTemplateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "label" TEXT,
    "points" REAL,
    "questionId" TEXT,
    "sourceAreaIdsJson" TEXT,
    "sourceQuestionNumbersJson" TEXT,
    "displayOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TemplateArea_examTemplateId_fkey" FOREIGN KEY ("examTemplateId") REFERENCES "ExamTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemplateArea_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TemplateArea" ("createdAt", "displayOrder", "examTemplateId", "height", "id", "label", "points", "sourceAreaIdsJson", "sourceQuestionNumbersJson", "type", "updatedAt", "width", "x", "y") SELECT "createdAt", "displayOrder", "examTemplateId", "height", "id", "label", "points", "sourceAreaIdsJson", "sourceQuestionNumbersJson", "type", "updatedAt", "width", "x", "y" FROM "TemplateArea";
DROP TABLE "TemplateArea";
ALTER TABLE "new_TemplateArea" RENAME TO "TemplateArea";
CREATE INDEX "TemplateArea_examTemplateId_idx" ON "TemplateArea"("examTemplateId");
CREATE INDEX "TemplateArea_questionId_idx" ON "TemplateArea"("questionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
