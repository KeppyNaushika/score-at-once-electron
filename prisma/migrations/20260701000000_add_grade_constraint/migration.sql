-- CreateTable: 観点間の制約ルール（不適切な観点/評定の組合せを検知して着色）
-- Grade個別に保持。kind別（consistency / mutual_exclusion / expression）。
CREATE TABLE "GradeConstraint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "expression" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL,
    "message" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeConstraint_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GradeConstraint_gradeId_idx" ON "GradeConstraint"("gradeId");
