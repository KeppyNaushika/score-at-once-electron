/*
  Warnings:

  - You are about to drop the `ExamSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectLayout` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Tag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ProjectTags` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `projectLayoutId` on the `LayoutRegion` table. All the data in the column will be lost.
  - You are about to drop the column `questionId` on the `LayoutRegion` table. All the data in the column will be lost.
  - You are about to drop the column `sourceAreaIdsJson` on the `LayoutRegion` table. All the data in the column will be lost.
  - You are about to drop the column `sourceQuestionNumbersJson` on the `LayoutRegion` table. All the data in the column will be lost.
  - You are about to alter the column `points` on the `LayoutRegion` table. The data in that column could be lost. The data in that column will be cast from `Float` to `Int`.
  - The primary key for the `Project` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `projectId` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `questionId` on the `QuestionScore` table. All the data in the column will be lost.
  - Added the required column `projectId` to the `LayoutRegion` table without a default value. This is not possible if the table is not empty.
  - Made the column `label` on table `LayoutRegion` required. This step will fail if there are existing NULL values in that column.
  - The required column `id` was added to the `Project` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Made the column `userId` on table `Project` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `layoutRegionId` to the `QuestionScore` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ProjectLayout_createdById_idx";

-- DropIndex
DROP INDEX "ProjectLayout_projectId_idx";

-- DropIndex
DROP INDEX "ProjectLayout_projectId_key";

-- DropIndex
DROP INDEX "Tag_text_key";

-- DropIndex
DROP INDEX "_ProjectTags_B_index";

-- DropIndex
DROP INDEX "_ProjectTags_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ExamSession";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ProjectLayout";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Question";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Tag";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ProjectTags";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "GradingAssignment" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("projectId", "userId"),
    CONSTRAINT "GradingAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionGroup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionGroupItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "questionGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionGroupItem_questionGroupId_fkey" FOREIGN KEY ("questionGroupId") REFERENCES "QuestionGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubtotalDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "layoutRegionId" TEXT NOT NULL,
    "questionGroupItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubtotalDefinition_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubtotalDefinition_questionGroupItemId_fkey" FOREIGN KEY ("questionGroupItemId") REFERENCES "QuestionGroupItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionSubtotalAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionLayoutRegionId" TEXT NOT NULL,
    "questionGroupItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionSubtotalAssignment_questionLayoutRegionId_fkey" FOREIGN KEY ("questionLayoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionSubtotalAssignment_questionGroupItemId_fkey" FOREIGN KEY ("questionGroupItemId") REFERENCES "QuestionGroupItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machineIdentifier" TEXT,
    "sessionStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionEndedAt" DATETIME,
    CONSTRAINT "ProjectSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnswerSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "originalImagePath" TEXT NOT NULL,
    "processedImagePath" TEXT,
    "scoredPdfPath" TEXT,
    "isScored" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" REAL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AnswerSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnswerSheet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AnswerSheet" ("createdAt", "id", "isAbsent", "isScored", "originalImagePath", "pageNumber", "processedImagePath", "projectId", "scoredPdfPath", "studentId", "totalScore", "updatedAt", "version") SELECT "createdAt", "id", "isAbsent", "isScored", "originalImagePath", "pageNumber", "processedImagePath", "projectId", "scoredPdfPath", "studentId", "totalScore", "updatedAt", "version" FROM "AnswerSheet";
DROP TABLE "AnswerSheet";
ALTER TABLE "new_AnswerSheet" RENAME TO "AnswerSheet";
CREATE INDEX "AnswerSheet_projectId_idx" ON "AnswerSheet"("projectId");
CREATE UNIQUE INDEX "AnswerSheet_projectId_studentId_pageNumber_key" ON "AnswerSheet"("projectId", "studentId", "pageNumber");
CREATE TABLE "new_LayoutRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "masterImageId" TEXT,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "questionNumber" TEXT,
    "points" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LayoutRegion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_masterImageId_fkey" FOREIGN KEY ("masterImageId") REFERENCES "MasterImage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LayoutRegion" ("createdAt", "height", "id", "label", "masterImageId", "points", "questionNumber", "type", "updatedAt", "width", "x", "y") SELECT "createdAt", "height", "id", "label", "masterImageId", "points", "questionNumber", "type", "updatedAt", "width", "x", "y" FROM "LayoutRegion";
DROP TABLE "LayoutRegion";
ALTER TABLE "new_LayoutRegion" RENAME TO "LayoutRegion";
CREATE INDEX "LayoutRegion_projectId_idx" ON "LayoutRegion"("projectId");
CREATE INDEX "LayoutRegion_masterImageId_idx" ON "LayoutRegion"("masterImageId");
CREATE TABLE "new_MasterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MasterImage" ("createdAt", "id", "pageNumber", "path", "projectId", "updatedAt") SELECT "createdAt", "id", "pageNumber", "path", "projectId", "updatedAt" FROM "MasterImage";
DROP TABLE "MasterImage";
ALTER TABLE "new_MasterImage" RENAME TO "MasterImage";
CREATE INDEX "MasterImage_projectId_idx" ON "MasterImage"("projectId");
CREATE UNIQUE INDEX "MasterImage_projectId_pageNumber_key" ON "MasterImage"("projectId", "pageNumber");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "subject" TEXT,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "description", "examDate", "examName", "updatedAt", "userId") SELECT "createdAt", "description", "examDate", "examName", "updatedAt", "userId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE TABLE "new_QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerSheetId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "score" REAL,
    "detectedAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_QuestionScore" ("answerSheetId", "comment", "createdAt", "detectedAnswer", "id", "isCorrect", "score", "scoreVersion", "scoredByUserId", "status", "updatedAt") SELECT "answerSheetId", "comment", "createdAt", "detectedAnswer", "id", "isCorrect", "score", "scoreVersion", "scoredByUserId", "status", "updatedAt" FROM "QuestionScore";
DROP TABLE "QuestionScore";
ALTER TABLE "new_QuestionScore" RENAME TO "QuestionScore";
CREATE INDEX "QuestionScore_answerSheetId_layoutRegionId_status_idx" ON "QuestionScore"("answerSheetId", "layoutRegionId", "status");
CREATE INDEX "QuestionScore_layoutRegionId_idx" ON "QuestionScore"("layoutRegionId");
CREATE UNIQUE INDEX "QuestionScore_answerSheetId_layoutRegionId_scoredByUserId_key" ON "QuestionScore"("answerSheetId", "layoutRegionId", "scoredByUserId");
CREATE TABLE "new_ScoreRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "totalScore" REAL NOT NULL,
    "excelOutputPath" TEXT,
    "pdfOutputPath" TEXT,
    "finalizedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScoreRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScoreRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScoreRecord_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScoreRecord" ("createdAt", "excelOutputPath", "finalizedByUserId", "id", "pdfOutputPath", "projectId", "studentId", "totalScore", "updatedAt") SELECT "createdAt", "excelOutputPath", "finalizedByUserId", "id", "pdfOutputPath", "projectId", "studentId", "totalScore", "updatedAt" FROM "ScoreRecord";
DROP TABLE "ScoreRecord";
ALTER TABLE "new_ScoreRecord" RENAME TO "ScoreRecord";
CREATE INDEX "ScoreRecord_projectId_idx" ON "ScoreRecord"("projectId");
CREATE UNIQUE INDEX "ScoreRecord_studentId_projectId_key" ON "ScoreRecord"("studentId", "projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GradingAssignment_userId_idx" ON "GradingAssignment"("userId");

-- CreateIndex
CREATE INDEX "QuestionGroup_projectId_idx" ON "QuestionGroup"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGroup_projectId_name_key" ON "QuestionGroup"("projectId", "name");

-- CreateIndex
CREATE INDEX "QuestionGroupItem_questionGroupId_idx" ON "QuestionGroupItem"("questionGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionGroupItem_questionGroupId_name_key" ON "QuestionGroupItem"("questionGroupId", "name");

-- CreateIndex
CREATE INDEX "SubtotalDefinition_layoutRegionId_idx" ON "SubtotalDefinition"("layoutRegionId");

-- CreateIndex
CREATE INDEX "SubtotalDefinition_questionGroupItemId_idx" ON "SubtotalDefinition"("questionGroupItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SubtotalDefinition_layoutRegionId_questionGroupItemId_key" ON "SubtotalDefinition"("layoutRegionId", "questionGroupItemId");

-- CreateIndex
CREATE INDEX "QuestionSubtotalAssignment_questionLayoutRegionId_idx" ON "QuestionSubtotalAssignment"("questionLayoutRegionId");

-- CreateIndex
CREATE INDEX "QuestionSubtotalAssignment_questionGroupItemId_idx" ON "QuestionSubtotalAssignment"("questionGroupItemId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSubtotalAssignment_questionLayoutRegionId_questionGroupItemId_key" ON "QuestionSubtotalAssignment"("questionLayoutRegionId", "questionGroupItemId");

-- CreateIndex
CREATE INDEX "ProjectSession_projectId_idx" ON "ProjectSession"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSession_userId_idx" ON "ProjectSession"("userId");
