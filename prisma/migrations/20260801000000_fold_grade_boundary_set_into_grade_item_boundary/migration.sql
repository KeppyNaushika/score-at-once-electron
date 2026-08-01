-- 境界セット（GradeBoundarySet）を畳み、境界を評価項目へ直付けする。
--
-- GradeBoundarySet は属性を1つも持たない容器だった。存在理由は「総合（overall）」—
-- 評価項目に属さない境界 — を置くことで、gradeItemId は nullable、ユニークは
-- (gradeId, targetType, gradeItemId) だった。総合の撤去（20260725170000）で
-- gradeItemId が NOT NULL になり @@unique([gradeId, gradeItemId]) が実質 1:1 を
-- 宣言した時点で、中間テーブルである必要は消えていた。
--
-- 残しておくと実害がある:
--   - upsert が既存セットの子だけを入れ替えるため、境界を全行消すと境界0件のセット行が
--     生き残る。「境界は無いのに設定済み」という状態が作れてしまう
--   - 進捗判定が Grade._count.boundarySets を見ており、上記の空セットで嘘をつく
--   - 容器を消すためだけの削除 API が要る
--   - gradeId は gradeItem.gradeId から辿れる冗長列で、id 以外の unique は
--     sqlite-nas-sync の運用方針に反する
--
-- 畳んだ結果、境界の有無は行の有無そのものになる。テーブル名も所属を表す
-- GradeItemBoundary へ改める。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "GradeItemBoundary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minPercentage" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeItemBoundary_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 対象の評価項目は親セットから引き継ぐ。親を失った孤児行は JOIN で落ちる
-- （FK は Cascade なので本来存在しないが、FK OFF で流し込まれた履歴があっても弾く）。
INSERT INTO "GradeItemBoundary" ("id", "gradeItemId", "label", "minPercentage", "order", "createdAt", "updatedAt")
SELECT
    "GradeBoundary"."id",
    "GradeBoundarySet"."gradeItemId",
    "GradeBoundary"."label",
    "GradeBoundary"."minPercentage",
    "GradeBoundary"."order",
    "GradeBoundary"."createdAt",
    "GradeBoundary"."updatedAt"
FROM "GradeBoundary"
JOIN "GradeBoundarySet" ON "GradeBoundarySet"."id" = "GradeBoundary"."gradeBoundarySetId";

CREATE INDEX "GradeItemBoundary_gradeItemId_idx" ON "GradeItemBoundary"("gradeItemId");

-- 旧テーブルを落とす（付随する索引も一緒に消える）。GradeBoundary を参照する子テーブルは
-- 無いので、他テーブルの FK 定義に旧名が残る心配はない。
DROP TABLE "GradeBoundary";
DROP TABLE "GradeBoundarySet";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
