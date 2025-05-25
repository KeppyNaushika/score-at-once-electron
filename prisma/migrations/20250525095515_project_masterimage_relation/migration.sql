/*
  Warnings:

  - You are about to drop the `Exam` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ExamScorers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `examId` on the `AnswerSheet` table. All the data in the column will be lost.
  - You are about to drop the column `examSessionId` on the `AnswerSheet` table. All the data in the column will be lost.
  - You are about to drop the column `examId` on the `ExamSession` table. All the data in the column will be lost.
  - You are about to drop the column `examId` on the `ExamTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `examId` on the `MasterImage` table. All the data in the column will be lost.
  - You are about to drop the column `examId` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `examId` on the `ScoreRecord` table. All the data in the column will be lost.
  - Added the required column `projectId` to the `AnswerSheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `ExamSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `MasterImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `ScoreRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "_ExamScorers_B_index";

-- DropIndex
DROP INDEX "_ExamScorers_AB_unique";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Exam";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "_ExamScorers";
PRAGMA foreign_keys=on;

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
    CONSTRAINT "AnswerSheet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnswerSheet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AnswerSheet" ("createdAt", "id", "isAbsent", "isScored", "originalImagePath", "pageNumber", "processedImagePath", "scoredPdfPath", "studentId", "totalScore", "updatedAt", "version") SELECT "createdAt", "id", "isAbsent", "isScored", "originalImagePath", "pageNumber", "processedImagePath", "scoredPdfPath", "studentId", "totalScore", "updatedAt", "version" FROM "AnswerSheet";
DROP TABLE "AnswerSheet";
ALTER TABLE "new_AnswerSheet" RENAME TO "AnswerSheet";
CREATE UNIQUE INDEX "AnswerSheet_projectId_studentId_pageNumber_key" ON "AnswerSheet"("projectId", "studentId", "pageNumber");
CREATE TABLE "new_ExamSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "machineIdentifier" TEXT,
    "sessionStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionEndedAt" DATETIME,
    CONSTRAINT "ExamSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExamSession" ("id", "machineIdentifier", "sessionEndedAt", "sessionStartedAt", "userId") SELECT "id", "machineIdentifier", "sessionEndedAt", "sessionStartedAt", "userId" FROM "ExamSession";
DROP TABLE "ExamSession";
ALTER TABLE "new_ExamSession" RENAME TO "ExamSession";
CREATE TABLE "new_ExamTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "templateData" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "scoreDisplayAreas" JSONB,
    CONSTRAINT "ExamTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExamTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ExamTemplate" ("createdAt", "createdById", "description", "id", "name", "scoreDisplayAreas", "templateData", "updatedAt") SELECT "createdAt", "createdById", "description", "id", "name", "scoreDisplayAreas", "templateData", "updatedAt" FROM "ExamTemplate";
DROP TABLE "ExamTemplate";
ALTER TABLE "new_ExamTemplate" RENAME TO "ExamTemplate";
CREATE TABLE "new_MasterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MasterImage" ("createdAt", "id", "pageNumber", "path", "updatedAt") SELECT "createdAt", "id", "pageNumber", "path", "updatedAt" FROM "MasterImage";
DROP TABLE "MasterImage";
ALTER TABLE "new_MasterImage" RENAME TO "MasterImage";
CREATE UNIQUE INDEX "MasterImage_projectId_pageNumber_key" ON "MasterImage"("projectId", "pageNumber");
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "points" REAL NOT NULL,
    "questionType" TEXT NOT NULL,
    "correctAnswer" TEXT,
    "answerArea" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Question" ("answerArea", "correctAnswer", "createdAt", "id", "points", "questionNumber", "questionType", "updatedAt") SELECT "answerArea", "correctAnswer", "createdAt", "id", "points", "questionNumber", "questionType", "updatedAt" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
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
    CONSTRAINT "ScoreRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScoreRecord_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScoreRecord" ("createdAt", "excelOutputPath", "finalizedByUserId", "id", "pdfOutputPath", "studentId", "totalScore", "updatedAt") SELECT "createdAt", "excelOutputPath", "finalizedByUserId", "id", "pdfOutputPath", "studentId", "totalScore", "updatedAt" FROM "ScoreRecord";
DROP TABLE "ScoreRecord";
ALTER TABLE "new_ScoreRecord" RENAME TO "ScoreRecord";
CREATE UNIQUE INDEX "ScoreRecord_studentId_projectId_key" ON "ScoreRecord"("studentId", "projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
