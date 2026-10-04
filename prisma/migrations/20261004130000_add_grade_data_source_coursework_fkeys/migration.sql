-- GradeDataSource の courseworkItemId / courseworkId に外部キー制約を張る。
--
-- schema.prisma は両方を `onDelete: SetNull` の relation として宣言しているが、列を足した
-- migration（20260623100000_promote_coursework / 20260702000000_add_coursework_id_to_grade_data_source）
-- が ALTER TABLE ... ADD COLUMN で制約なしに足したため、migration で作った DB にだけ制約が無い。
-- `prisma db push` で作るテスト用の DB には在るので、テストは通るのに、本番では資料を消しても
-- データソースが消えた資料の id を指したまま残る。同期（sqlite-nas-sync）も親が消えたときの
-- 子の扱いを DB に宣言された外部キーで決めるので、制約が無いと全端末で宙に浮いたまま残る。
--
-- 既存の表に外部キーは足せないので、表を作り直す。同期を使っている DB では、変更を記録する
-- トリガーは元の表と一緒に消え、次の setupSync が新しい形で作り直す（ライブラリの README
-- 「列は DROP COLUMN では削除できない」と同じ手順）。
--
-- 作り直す前に、消えた資料・評価項目を指す値を NULL にする（制約の宣言どおりの値へ揃える）。
-- 古い表で UPDATE するので、同期のトリガーがこの変更を記録して他の端末へ伝える。参照先は
-- データソースが入っていれば必ず一緒に入る（成績算出が使う資料は外せない）ので、統合
-- アーカイブの一部だけの DB に当てても、全体に当てた場合と結果は変わらない。
UPDATE "GradeDataSource" SET "courseworkItemId" = NULL
WHERE "courseworkItemId" IS NOT NULL
  AND "courseworkItemId" NOT IN (SELECT "id" FROM "CourseworkItem");

UPDATE "GradeDataSource" SET "courseworkId" = NULL
WHERE "courseworkId" IS NOT NULL
  AND "courseworkId" NOT IN (SELECT "id" FROM "Coursework");

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_GradeDataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "examId" TEXT,
    "subtotalId" TEXT,
    "cropRegionId" TEXT,
    "name" TEXT NOT NULL,
    "weight" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "absentMethod" TEXT NOT NULL DEFAULT 'null',
    "absentRatio" DECIMAL NOT NULL DEFAULT 1.0,
    "absentOffset" DECIMAL NOT NULL DEFAULT 0,
    "treatExpectedAsMissing" BOOLEAN NOT NULL DEFAULT false,
    "estimationMode" TEXT NOT NULL DEFAULT 'all',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "courseworkItemId" TEXT,
    "courseworkId" TEXT,
    CONSTRAINT "GradeDataSource_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_subtotalId_fkey" FOREIGN KEY ("subtotalId") REFERENCES "Subtotal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_courseworkItemId_fkey" FOREIGN KEY ("courseworkItemId") REFERENCES "CourseworkItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSource_courseworkId_fkey" FOREIGN KEY ("courseworkId") REFERENCES "Coursework" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_GradeDataSource" ("id", "gradeItemId", "type", "examId", "subtotalId", "cropRegionId", "name", "weight", "order", "absentMethod", "absentRatio", "absentOffset", "treatExpectedAsMissing", "estimationMode", "createdAt", "updatedAt", "courseworkItemId", "courseworkId")
SELECT "id", "gradeItemId", "type", "examId", "subtotalId", "cropRegionId", "name", "weight", "order", "absentMethod", "absentRatio", "absentOffset", "treatExpectedAsMissing", "estimationMode", "createdAt", "updatedAt", "courseworkItemId", "courseworkId"
FROM "GradeDataSource";

DROP TABLE "GradeDataSource";
ALTER TABLE "new_GradeDataSource" RENAME TO "GradeDataSource";

CREATE INDEX "GradeDataSource_gradeItemId_idx" ON "GradeDataSource"("gradeItemId");
CREATE INDEX "GradeDataSource_examId_idx" ON "GradeDataSource"("examId");
CREATE INDEX "GradeDataSource_subtotalId_idx" ON "GradeDataSource"("subtotalId");
CREATE INDEX "GradeDataSource_cropRegionId_idx" ON "GradeDataSource"("cropRegionId");
CREATE INDEX "GradeDataSource_courseworkItemId_idx" ON "GradeDataSource"("courseworkItemId");
CREATE INDEX "GradeDataSource_courseworkId_idx" ON "GradeDataSource"("courseworkId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
