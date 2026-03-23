/*
  Warnings:

  - You are about to drop the column `cellGeometryJson` on the `CropRegionOmrConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "normalizedCx" REAL;
ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "normalizedCy" REAL;
ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "normalizedHeight" REAL;
ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "normalizedWidth" REAL;
ALTER TABLE "CropRegionOmrChoiceOption" ADD COLUMN "shape" TEXT DEFAULT 'ellipse';

-- CreateTable
CREATE TABLE "CropRegionOmrDigitBox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "omrConfigId" TEXT NOT NULL,
    "digitIndex" INTEGER NOT NULL,
    "normalizedX" REAL NOT NULL,
    "normalizedY" REAL NOT NULL,
    "normalizedW" REAL NOT NULL,
    "normalizedH" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropRegionOmrDigitBox_omrConfigId_fkey" FOREIGN KEY ("omrConfigId") REFERENCES "CropRegionOmrConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompoundAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examPageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "answerFormat" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER,
    "alternativeAnswers" TEXT,
    "requireReduced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundAnswer_examPageId_fkey" FOREIGN KEY ("examPageId") REFERENCES "ExamPage" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "CompoundAnswerMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundAnswerId" TEXT NOT NULL,
    "cropRegionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "roleLabel" TEXT,
    "separator" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundAnswerMember_compoundAnswerId_fkey" FOREIGN KEY ("compoundAnswerId") REFERENCES "CompoundAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompoundAnswerMember_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompoundAnswerScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "compoundAnswerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recognizedAnswer" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unscored',
    "partialScore" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompoundAnswerScore_compoundAnswerId_fkey" FOREIGN KEY ("compoundAnswerId") REFERENCES "CompoundAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompoundAnswerScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "CompoundAnswerScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CropRegionOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "numDigits" INTEGER,
    "correctAnswer" TEXT,
    "colorThreshold" INTEGER,
    "areaThreshold" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CropRegionOmrConfig_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CropRegionOmrConfig" ("areaThreshold", "choiceLayout", "colorThreshold", "correctAnswer", "createdAt", "cropRegionId", "id", "numChoices", "numDigits", "type", "updatedAt") SELECT "areaThreshold", "choiceLayout", "colorThreshold", "correctAnswer", "createdAt", "cropRegionId", "id", "numChoices", "numDigits", "type", "updatedAt" FROM "CropRegionOmrConfig";
DROP TABLE "CropRegionOmrConfig";
ALTER TABLE "new_CropRegionOmrConfig" RENAME TO "CropRegionOmrConfig";
CREATE UNIQUE INDEX "CropRegionOmrConfig_cropRegionId_key" ON "CropRegionOmrConfig"("cropRegionId");
CREATE INDEX "CropRegionOmrConfig_cropRegionId_idx" ON "CropRegionOmrConfig"("cropRegionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CropRegionOmrDigitBox_omrConfigId_idx" ON "CropRegionOmrDigitBox"("omrConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "CropRegionOmrDigitBox_omrConfigId_digitIndex_key" ON "CropRegionOmrDigitBox"("omrConfigId", "digitIndex");

-- CreateIndex
CREATE INDEX "CompoundAnswer_examPageId_idx" ON "CompoundAnswer"("examPageId");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundAnswerMember_cropRegionId_key" ON "CompoundAnswerMember"("cropRegionId");

-- CreateIndex
CREATE INDEX "CompoundAnswerMember_compoundAnswerId_idx" ON "CompoundAnswerMember"("compoundAnswerId");

-- CreateIndex
CREATE INDEX "CompoundAnswerScore_compoundAnswerId_idx" ON "CompoundAnswerScore"("compoundAnswerId");

-- CreateIndex
CREATE INDEX "CompoundAnswerScore_studentId_idx" ON "CompoundAnswerScore"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CompoundAnswerScore_compoundAnswerId_studentId_key" ON "CompoundAnswerScore"("compoundAnswerId", "studentId");
