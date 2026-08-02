-- ExamSubtotalGroup に @@unique([examId, subtotalGroupId]) を入れ、idを決定論的にする。
--
-- この表だけ同型の中間テーブル（UserExam / ExamClassroom / ExamTag / GradeClassroom …）が
-- 持つ @@unique を欠いており、同じ組み合わせを2回追加すると重複行ができた。重複すると
-- selectedForTable / selectedForBoxPlot が行ごとに食い違い、どちらが効くかが読み取り順
-- 次第になる（Excelの小計点テーブルと箱ひげ図の対象が非決定的になる）。
--
-- ただし unique を足すだけでは不足で、id も決定論的にする必要がある。@default(uuid()) の
-- ままだと、2端末が同じ組み合わせを追加したとき id 違い・unique 同値の行ができ、NAS同期で
-- 衝突する。CropRegionAssignment / GradeConstraintViewpoint 等と同じく `親id:子id` 形式へ
-- 揃える（deterministicId.ts の joinIds。uuidv5 でないのは、この移行が SQL 側で同じidを
-- 組み立てられる必要があり SQLite に sha1 が無いため）。

-- 重複行を潰す。先に**フラグを重複行をまたいで OR してから**1件へ絞る。
-- 読み取り側（getSubtotalGroupSelection）が「1行でも true なら選択」と見ているため、
-- 最古の行の値をそのまま採ると、新しい行にしか無い選択が黙って消える
-- （箱ひげ図・小計点テーブルの対象が予告なく外れる）。
UPDATE "ExamSubtotalGroup"
SET
    "selectedForTable" = (
        SELECT MAX("sibling"."selectedForTable") FROM "ExamSubtotalGroup" AS "sibling"
        WHERE "sibling"."examId" = "ExamSubtotalGroup"."examId"
          AND "sibling"."subtotalGroupId" = "ExamSubtotalGroup"."subtotalGroupId"
    ),
    "selectedForBoxPlot" = (
        SELECT MAX("sibling"."selectedForBoxPlot") FROM "ExamSubtotalGroup" AS "sibling"
        WHERE "sibling"."examId" = "ExamSubtotalGroup"."examId"
          AND "sibling"."subtotalGroupId" = "ExamSubtotalGroup"."subtotalGroupId"
    );

-- 残すのは createdAt が最も古い1件（同値なら id 順）。rowid ではなく行の値で選ぶのは、
-- 各端末が自分のDBに対してこの移行を走らせるため。挿入順に依存すると端末ごとに
-- 生き残る行が変わり、createdAt / updatedAt が食い違って以後の LWW がぶれる
DELETE FROM "ExamSubtotalGroup"
WHERE EXISTS (
    SELECT 1 FROM "ExamSubtotalGroup" AS "older"
    WHERE "older"."examId" = "ExamSubtotalGroup"."examId"
      AND "older"."subtotalGroupId" = "ExamSubtotalGroup"."subtotalGroupId"
      AND (
        "older"."createdAt" < "ExamSubtotalGroup"."createdAt"
        OR ("older"."createdAt" = "ExamSubtotalGroup"."createdAt"
            AND "older"."id" < "ExamSubtotalGroup"."id")
      )
);

-- 既存行のidを決定論的idへ振り直す。他テーブルからの外部キー参照は無い
UPDATE "ExamSubtotalGroup"
SET "id" = "examId" || ':' || "subtotalGroupId";

-- RedefineTables（@default(uuid()) を外し、unique と index を付ける）
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ExamSubtotalGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "subtotalGroupId" TEXT NOT NULL,
    "selectedForTable" BOOLEAN NOT NULL DEFAULT false,
    "selectedForBoxPlot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamSubtotalGroup_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "ExamSubtotalGroup_subtotalGroupId_fkey" FOREIGN KEY ("subtotalGroupId") REFERENCES "SubtotalGroup" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

INSERT INTO "new_ExamSubtotalGroup" ("id", "examId", "subtotalGroupId", "selectedForTable", "selectedForBoxPlot", "createdAt", "updatedAt")
SELECT "id", "examId", "subtotalGroupId", "selectedForTable", "selectedForBoxPlot", "createdAt", "updatedAt"
FROM "ExamSubtotalGroup";

DROP TABLE "ExamSubtotalGroup";
ALTER TABLE "new_ExamSubtotalGroup" RENAME TO "ExamSubtotalGroup";

CREATE UNIQUE INDEX "ExamSubtotalGroup_examId_subtotalGroupId_key" ON "ExamSubtotalGroup"("examId", "subtotalGroupId");
CREATE INDEX "ExamSubtotalGroup_examId_idx" ON "ExamSubtotalGroup"("examId");
CREATE INDEX "ExamSubtotalGroup_subtotalGroupId_idx" ON "ExamSubtotalGroup"("subtotalGroupId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
