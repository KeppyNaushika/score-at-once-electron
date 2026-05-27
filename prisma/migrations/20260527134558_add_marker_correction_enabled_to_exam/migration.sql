-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examName" TEXT NOT NULL,
    "examDate" DATETIME,
    "description" TEXT,
    "markerCorrectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Exam" ("createdAt", "description", "examDate", "examName", "id", "updatedAt") SELECT "createdAt", "description", "examDate", "examName", "id", "updatedAt" FROM "Exam";
DROP TABLE "Exam";
ALTER TABLE "new_Exam" RENAME TO "Exam";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
