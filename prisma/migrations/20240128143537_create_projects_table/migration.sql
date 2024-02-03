/*
  Warnings:

  - You are about to drop the `ExamDate` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `examDate` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ExamDate_date_projectId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ExamDate";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" TEXT NOT NULL,
    "examName" TEXT NOT NULL DEFAULT '',
    "examDate" DATETIME NOT NULL,
    "selected" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("createdAt", "examName", "id", "projectId", "selected", "updatedAt") SELECT "createdAt", "examName", "id", "projectId", "selected", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_projectId_key" ON "Project"("projectId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
