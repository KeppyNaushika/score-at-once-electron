/*
  Warnings:

  - You are about to drop the column `displayOrder` on the `LayoutRegion` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LayoutRegion" (
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
    "questionNumber" TEXT,
    "sourceAreaIdsJson" TEXT,
    "sourceQuestionNumbersJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "questionId" TEXT,
    CONSTRAINT "LayoutRegion_projectLayoutId_fkey" FOREIGN KEY ("projectLayoutId") REFERENCES "ProjectLayout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_masterImageId_fkey" FOREIGN KEY ("masterImageId") REFERENCES "MasterImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LayoutRegion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LayoutRegion" ("createdAt", "height", "id", "label", "masterImageId", "points", "projectLayoutId", "questionId", "sourceAreaIdsJson", "sourceQuestionNumbersJson", "type", "updatedAt", "width", "x", "y") SELECT "createdAt", "height", "id", "label", "masterImageId", "points", "projectLayoutId", "questionId", "sourceAreaIdsJson", "sourceQuestionNumbersJson", "type", "updatedAt", "width", "x", "y" FROM "LayoutRegion";
DROP TABLE "LayoutRegion";
ALTER TABLE "new_LayoutRegion" RENAME TO "LayoutRegion";
CREATE INDEX "LayoutRegion_projectLayoutId_idx" ON "LayoutRegion"("projectLayoutId");
CREATE INDEX "LayoutRegion_masterImageId_idx" ON "LayoutRegion"("masterImageId");
CREATE TABLE "new_MasterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MasterImage" ("createdAt", "id", "pageNumber", "path", "projectId", "updatedAt") SELECT "createdAt", "id", "pageNumber", "path", "projectId", "updatedAt" FROM "MasterImage";
DROP TABLE "MasterImage";
ALTER TABLE "new_MasterImage" RENAME TO "MasterImage";
CREATE INDEX "MasterImage_projectId_idx" ON "MasterImage"("projectId");
CREATE UNIQUE INDEX "MasterImage_projectId_pageNumber_key" ON "MasterImage"("projectId", "pageNumber");
CREATE TABLE "new_Project" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "description" TEXT,
    "examDate" DATETIME,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "description", "examDate", "examName", "projectId", "updatedAt", "userId") SELECT "createdAt", "description", "examDate", "examName", "projectId", "updatedAt", "userId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_userId_idx" ON "Project"("userId");
CREATE TABLE "new_ProjectLayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectLayout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectLayout_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProjectLayout" ("createdAt", "createdById", "id", "projectId", "updatedAt") SELECT "createdAt", "createdById", "id", "projectId", "updatedAt" FROM "ProjectLayout";
DROP TABLE "ProjectLayout";
ALTER TABLE "new_ProjectLayout" RENAME TO "ProjectLayout";
CREATE UNIQUE INDEX "ProjectLayout_projectId_key" ON "ProjectLayout"("projectId");
CREATE INDEX "ProjectLayout_projectId_idx" ON "ProjectLayout"("projectId");
CREATE INDEX "ProjectLayout_createdById_idx" ON "ProjectLayout"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
