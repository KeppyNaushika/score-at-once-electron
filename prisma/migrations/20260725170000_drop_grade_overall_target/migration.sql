-- 総合（overall）の撤去。
--
-- 総合は「除外されていない全評価項目の加重平均」で、評定を評価項目として持つ運用では
-- 評定そのものを観点と一緒に平均へ混ぜる無意味な集計だった。UI にも総合の境界を作る
-- 導線が無く、結果表にも列が無い。残っていたのは残骸なので targetType ごと撤去する。
--
-- 撤去に伴い gradeItemId を NOT NULL にできる。総合が唯一の NULL ケースだったため。
-- これで SQLite が unique 制約で NULL を互いに別物と扱う罠（GradeOverride が
-- findFirst + create/update で回避していたもの）も同時に消える。

-- 総合の行を先に削除する。gradeItemId が NULL なので、そのままでは NOT NULL 化した
-- 新テーブルへ移せない。GradeBoundary は onDelete:Cascade で追随する。
DELETE FROM "GradeBoundary" WHERE "gradeBoundarySetId" IN (
    SELECT "id" FROM "GradeBoundarySet" WHERE "targetType" = 'overall'
);
DELETE FROM "GradeBoundarySet" WHERE "targetType" = 'overall';
DELETE FROM "GradeOverride" WHERE "targetType" = 'overall';

-- 念のため、targetType が 'grade_item' でも gradeItemId が NULL の不整合行を落とす
-- （NOT NULL 化した新テーブルへの INSERT が失敗するのを防ぐ）。
DELETE FROM "GradeBoundary" WHERE "gradeBoundarySetId" IN (
    SELECT "id" FROM "GradeBoundarySet" WHERE "gradeItemId" IS NULL
);
DELETE FROM "GradeBoundarySet" WHERE "gradeItemId" IS NULL;
DELETE FROM "GradeOverride" WHERE "gradeItemId" IS NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_GradeBoundarySet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeBoundarySet_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeBoundarySet_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GradeBoundarySet" ("createdAt", "gradeId", "gradeItemId", "id", "updatedAt") SELECT "createdAt", "gradeId", "gradeItemId", "id", "updatedAt" FROM "GradeBoundarySet";
DROP TABLE "GradeBoundarySet";
ALTER TABLE "new_GradeBoundarySet" RENAME TO "GradeBoundarySet";
CREATE INDEX "GradeBoundarySet_gradeId_idx" ON "GradeBoundarySet"("gradeId");
CREATE UNIQUE INDEX "GradeBoundarySet_gradeId_gradeItemId_key" ON "GradeBoundarySet"("gradeId", "gradeItemId");

CREATE TABLE "new_GradeOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "overrideLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeOverride_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeOverride_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeOverride_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GradeOverride" ("createdAt", "gradeId", "gradeItemId", "id", "overrideLabel", "studentId", "updatedAt") SELECT "createdAt", "gradeId", "gradeItemId", "id", "overrideLabel", "studentId", "updatedAt" FROM "GradeOverride";
DROP TABLE "GradeOverride";
ALTER TABLE "new_GradeOverride" RENAME TO "GradeOverride";
CREATE INDEX "GradeOverride_gradeId_idx" ON "GradeOverride"("gradeId");
CREATE INDEX "GradeOverride_studentId_idx" ON "GradeOverride"("studentId");
CREATE INDEX "GradeOverride_gradeItemId_idx" ON "GradeOverride"("gradeItemId");
CREATE UNIQUE INDEX "GradeOverride_gradeId_studentId_gradeItemId_key" ON "GradeOverride"("gradeId", "studentId", "gradeItemId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
