/*
  Warnings:

  - You are about to drop the `ExamTemplate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TemplateArea` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ExamTemplate";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TemplateArea";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "ProjectLayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "ProjectLayout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectLayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LayoutRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectLayoutId" TEXT NOT NULL,
    "masterImageId" TEXT NOT NULL,
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
    CONSTRAINT "LayoutRegion_projectLayoutId_fkey" FOREIGN KEY ("projectLayoutId") REFERENCES "ProjectLayout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_masterImageId_fkey" FOREIGN KEY ("masterImageId") REFERENCES "MasterImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLayout_projectId_key" ON "ProjectLayout"("projectId");

-- CreateIndex
CREATE INDEX "LayoutRegion_projectLayoutId_idx" ON "LayoutRegion"("projectLayoutId");

-- CreateIndex
CREATE INDEX "LayoutRegion_questionId_idx" ON "LayoutRegion"("questionId");

-- CreateIndex
CREATE INDEX "LayoutRegion_masterImageId_idx" ON "LayoutRegion"("masterImageId");
