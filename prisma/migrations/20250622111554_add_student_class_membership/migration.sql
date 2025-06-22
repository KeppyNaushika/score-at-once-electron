/*
  Warnings:

  - You are about to drop the column `classId` on the `Student` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "StudentClassMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "membershipType" TEXT NOT NULL DEFAULT 'REGULAR',
    "subject" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentClassMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentClassMembership_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enrollmentYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Student" ("createdAt", "id", "name", "studentId", "updatedAt") SELECT "createdAt", "id", "name", "studentId", "updatedAt" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");
CREATE TABLE "new_classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "grade" INTEGER,
    "description" TEXT,
    "subject" TEXT,
    "classType" TEXT NOT NULL DEFAULT 'HOMEROOM',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_classes" ("createdAt", "description", "grade", "id", "name", "updatedAt") SELECT "createdAt", "description", "grade", "id", "name", "updatedAt" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StudentClassMembership_studentId_idx" ON "StudentClassMembership"("studentId");

-- CreateIndex
CREATE INDEX "StudentClassMembership_classId_idx" ON "StudentClassMembership"("classId");

-- CreateIndex
CREATE INDEX "StudentClassMembership_startDate_endDate_idx" ON "StudentClassMembership"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "StudentClassMembership_studentId_classId_startDate_key" ON "StudentClassMembership"("studentId", "classId", "startDate");
