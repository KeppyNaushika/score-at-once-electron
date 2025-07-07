/*
  Warnings:

  - You are about to drop the column `detectedAnswer` on the `QuestionScore` table. All the data in the column will be lost.
  - You are about to drop the column `isCorrect` on the `QuestionScore` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `QuestionScore` table. All the data in the column will be lost.
  - Made the column `masterImageId` on table `LayoutRegion` required. This step will fail if there are existing NULL values in that column.

*/
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
    "questionNumber" TEXT,
    "points" INTEGER,
    "orderIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LayoutRegion_masterImageId_fkey" FOREIGN KEY ("masterImageId") REFERENCES "MasterImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_LayoutRegion" ("createdAt", "height", "id", "label", "masterImageId", "points", "projectId", "questionNumber", "type", "updatedAt", "width", "x", "y") SELECT "createdAt", "height", "id", "label", "masterImageId", "points", "projectId", "questionNumber", "type", "updatedAt", "width", "x", "y" FROM "LayoutRegion";
DROP TABLE "LayoutRegion";
ALTER TABLE "new_LayoutRegion" RENAME TO "LayoutRegion";
CREATE INDEX "LayoutRegion_projectId_idx" ON "LayoutRegion"("projectId");
CREATE INDEX "LayoutRegion_masterImageId_idx" ON "LayoutRegion"("masterImageId");
CREATE TABLE "new_QuestionScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerSheetId" TEXT NOT NULL,
    "layoutRegionId" TEXT NOT NULL,
    "partialScore" DECIMAL,
    "comment" TEXT,
    "scoredByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionScore_scoredByUserId_fkey" FOREIGN KEY ("scoredByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_layoutRegionId_fkey" FOREIGN KEY ("layoutRegionId") REFERENCES "LayoutRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestionScore_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "AnswerSheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuestionScore" ("answerSheetId", "comment", "createdAt", "id", "layoutRegionId", "scoreVersion", "scoredByUserId", "status", "updatedAt") SELECT "answerSheetId", "comment", "createdAt", "id", "layoutRegionId", "scoreVersion", "scoredByUserId", "status", "updatedAt" FROM "QuestionScore";
DROP TABLE "QuestionScore";
ALTER TABLE "new_QuestionScore" RENAME TO "QuestionScore";
CREATE INDEX "QuestionScore_answerSheetId_layoutRegionId_status_idx" ON "QuestionScore"("answerSheetId", "layoutRegionId", "status");
CREATE INDEX "QuestionScore_layoutRegionId_idx" ON "QuestionScore"("layoutRegionId");
CREATE UNIQUE INDEX "QuestionScore_answerSheetId_layoutRegionId_scoredByUserId_key" ON "QuestionScore"("answerSheetId", "layoutRegionId", "scoredByUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
