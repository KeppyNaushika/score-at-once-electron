/*
  Warnings:

  - You are about to drop the column `questionNumber` on the `LayoutRegion` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "partLabel" TEXT NOT NULL DEFAULT '',
    "partScore" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionPart_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPart_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestionPartScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionPartId" TEXT NOT NULL,
    "answerSheetId" TEXT NOT NULL,
    "score" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionPartScore_questionPartId_fkey" FOREIGN KEY ("questionPartId") REFERENCES "QuestionPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPartScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionPartScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LayoutRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "masterImageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "width" REAL NOT NULL,
    "height" REAL NOT NULL,
    "points" INTEGER,
    "orderIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LayoutRegion_masterImageId_fkey" FOREIGN KEY ("masterImageId") REFERENCES "MasterImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LayoutRegion" ("createdAt", "height", "id", "label", "masterImageId", "orderIndex", "points", "projectId", "type", "updatedAt", "width", "x", "y") SELECT "createdAt", "height", "id", "label", "masterImageId", "orderIndex", "points", "projectId", "type", "updatedAt", "width", "x", "y" FROM "LayoutRegion";
DROP TABLE "LayoutRegion";
ALTER TABLE "new_LayoutRegion" RENAME TO "LayoutRegion";
CREATE INDEX "LayoutRegion_projectId_idx" ON "LayoutRegion"("projectId");
CREATE INDEX "LayoutRegion_masterImageId_idx" ON "LayoutRegion"("masterImageId");
CREATE TABLE "new_QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT,
    "answerSheetId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionScore_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuestionScore" ("answerSheetId", "comment", "createdAt", "id", "layoutRegionId", "partialScore", "scoreVersion", "scoredByUserId", "status", "updatedAt") SELECT "answerSheetId", "comment", "createdAt", "id", "layoutRegionId", "partialScore", "scoreVersion", "scoredByUserId", "status", "updatedAt" FROM "QuestionScore";
DROP TABLE "QuestionScore";
ALTER TABLE "new_QuestionScore" RENAME TO "QuestionScore";
CREATE INDEX "QuestionScore_answerSheetId_layoutRegionId_status_idx" ON "QuestionScore"("answerSheetId", "layoutRegionId", "status");
CREATE INDEX "QuestionScore_layoutRegionId_idx" ON "QuestionScore"("layoutRegionId");
CREATE INDEX "QuestionScore_questionId_idx" ON "QuestionScore"("questionId");
CREATE UNIQUE INDEX "QuestionScore_answerSheetId_layoutRegionId_scoredByUserId_key" ON "QuestionScore"("answerSheetId", "layoutRegionId", "scoredByUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Question_projectId_idx" ON "Question"("projectId");

-- CreateIndex
CREATE INDEX "Question_projectId_orderIndex_idx" ON "Question"("projectId", "orderIndex");

-- CreateIndex
CREATE INDEX "QuestionPart_questionId_idx" ON "QuestionPart"("questionId");

-- CreateIndex
CREATE INDEX "QuestionPart_layoutRegionId_idx" ON "QuestionPart"("layoutRegionId");

-- CreateIndex
CREATE INDEX "QuestionPart_questionId_orderIndex_idx" ON "QuestionPart"("questionId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPart_questionId_layoutRegionId_key" ON "QuestionPart"("questionId", "layoutRegionId");

-- CreateIndex
CREATE INDEX "QuestionPartScore_questionPartId_idx" ON "QuestionPartScore"("questionPartId");

-- CreateIndex
CREATE INDEX "QuestionPartScore_answerSheetId_idx" ON "QuestionPartScore"("answerSheetId");

-- CreateIndex
CREATE INDEX "QuestionPartScore_scoredByUserId_idx" ON "QuestionPartScore"("scoredByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPartScore_questionPartId_answerSheetId_scoredByUserId_key" ON "QuestionPartScore"("questionPartId", "answerSheetId", "scoredByUserId");
