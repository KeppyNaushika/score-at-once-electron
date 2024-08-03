/*
  Warnings:

  - You are about to drop the column `selected` on the `Project` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" TEXT NOT NULL,
    "examName" TEXT NOT NULL DEFAULT '',
    "examDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("createdAt", "examDate", "examName", "id", "projectId", "updatedAt") SELECT "createdAt", "examDate", "examName", "id", "projectId", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_projectId_key" ON "Project"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
