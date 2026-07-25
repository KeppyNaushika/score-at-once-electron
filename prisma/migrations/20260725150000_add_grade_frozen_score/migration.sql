-- CreateTable: 成績値の確定（凍結）。確定時点の実効値を保存し参照資料・境界の変更に追従させない
CREATE TABLE "GradeFrozenScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "weightedScore" DECIMAL,
    "weightedMaxScore" DECIMAL NOT NULL,
    "percentage" DECIMAL,
    "gradeLabel" TEXT,
    "frozenByUserId" TEXT,
    "frozenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeFrozenScore_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeFrozenScore_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeFrozenScore_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeFrozenScore_frozenByUserId_fkey" FOREIGN KEY ("frozenByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GradeFrozenScore_gradeId_idx" ON "GradeFrozenScore"("gradeId");

-- CreateIndex
CREATE INDEX "GradeFrozenScore_studentId_idx" ON "GradeFrozenScore"("studentId");

-- CreateIndex
CREATE INDEX "GradeFrozenScore_gradeItemId_idx" ON "GradeFrozenScore"("gradeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeFrozenScore_gradeId_studentId_gradeItemId_key" ON "GradeFrozenScore"("gradeId", "studentId", "gradeItemId");
