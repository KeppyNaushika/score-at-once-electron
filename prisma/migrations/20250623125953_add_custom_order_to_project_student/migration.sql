/*
  Warnings:

  - You are about to drop the column `examStatus` on the `StudentClassMembership` table. All the data in the column will be lost.
  - You are about to drop the column `membershipType` on the `StudentClassMembership` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `StudentClassMembership` table. All the data in the column will be lost.
  - You are about to drop the column `subject` on the `classes` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "ProjectStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PARTICIPATING',
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectStudent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudentClassMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "attendanceNumber" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentClassMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentClassMembership_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudentClassMembership" ("classId", "createdAt", "endDate", "id", "notes", "startDate", "studentId", "updatedAt") SELECT "classId", "createdAt", "endDate", "id", "notes", "startDate", "studentId", "updatedAt" FROM "StudentClassMembership";
DROP TABLE "StudentClassMembership";
ALTER TABLE "new_StudentClassMembership" RENAME TO "StudentClassMembership";
CREATE INDEX "StudentClassMembership_studentId_idx" ON "StudentClassMembership"("studentId");
CREATE INDEX "StudentClassMembership_classId_idx" ON "StudentClassMembership"("classId");
CREATE INDEX "StudentClassMembership_startDate_endDate_idx" ON "StudentClassMembership"("startDate", "endDate");
CREATE INDEX "StudentClassMembership_classId_attendanceNumber_idx" ON "StudentClassMembership"("classId", "attendanceNumber");
CREATE TABLE "new_classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "classCode" TEXT,
    "grade" INTEGER,
    "description" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_classes" ("classCode", "createdAt", "description", "grade", "id", "isVisible", "name", "updatedAt") SELECT "classCode", "createdAt", "description", "grade", "id", "isVisible", "name", "updatedAt" FROM "classes";
DROP TABLE "classes";
ALTER TABLE "new_classes" RENAME TO "classes";
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProjectStudent_projectId_idx" ON "ProjectStudent"("projectId");

-- CreateIndex
CREATE INDEX "ProjectStudent_studentId_idx" ON "ProjectStudent"("studentId");

-- CreateIndex
CREATE INDEX "ProjectStudent_projectId_customOrder_idx" ON "ProjectStudent"("projectId", "customOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStudent_projectId_studentId_key" ON "ProjectStudent"("projectId", "studentId");
