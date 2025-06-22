-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudentClassMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "membershipType" TEXT NOT NULL DEFAULT 'REGULAR',
    "examStatus" TEXT NOT NULL DEFAULT 'TAKING',
    "subject" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentClassMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentClassMembership_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudentClassMembership" ("classId", "createdAt", "endDate", "id", "membershipType", "notes", "startDate", "studentId", "subject", "updatedAt") SELECT "classId", "createdAt", "endDate", "id", "membershipType", "notes", "startDate", "studentId", "subject", "updatedAt" FROM "StudentClassMembership";
DROP TABLE "StudentClassMembership";
ALTER TABLE "new_StudentClassMembership" RENAME TO "StudentClassMembership";
CREATE INDEX "StudentClassMembership_studentId_idx" ON "StudentClassMembership"("studentId");
CREATE INDEX "StudentClassMembership_classId_idx" ON "StudentClassMembership"("classId");
CREATE INDEX "StudentClassMembership_startDate_endDate_idx" ON "StudentClassMembership"("startDate", "endDate");
CREATE UNIQUE INDEX "StudentClassMembership_studentId_classId_startDate_key" ON "StudentClassMembership"("studentId", "classId", "startDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
