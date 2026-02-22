-- CreateTable
CREATE TABLE "GradeProjectExportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeProjectId" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeProjectExportSettings_gradeProjectId_fkey" FOREIGN KEY ("gradeProjectId") REFERENCES "GradeProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeProjectExportSettings_gradeProjectId_key" ON "GradeProjectExportSettings"("gradeProjectId");
