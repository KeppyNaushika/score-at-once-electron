-- 原稿用紙を AsbSubQuestion の列から AsbManuscriptPaper テーブルへ出し、枝問にも生やす。
--
-- 設定6項目は DB では小問の列として平らに並び、画面では manuscriptPaper という入れ子に
-- 束ね直されていた。段差があるために合流の規則が2種類になり、原稿用紙と無関係な更新が
-- 設定を消す事故が出た（docs/asb-ipc-split-plan.md §8.5）。列のままで枝問へ生やすと同じ列を
-- AsbBranchQuestion へ複製することになるので、AsbOmrConfig と同じ形のテーブルへ出す。
--
-- 文字位置マーカー（AsbCharGuide）の親も「小問」から「原稿用紙」へ付け替える。
-- AsbOmrChoiceOption → AsbOmrConfig と同じで、マーカーは原稿用紙の持ち物である。
--
-- 行を作る条件は「manuscriptEnabled が立っている」「文字位置マーカーを持つ」「設定が既定と
-- 違う」のいずれか。既定のまま一度も使っていない小問に空の行は作らない（行の不在が
-- 「一度も使っていない」を表す）。
--
-- AsbSubQuestion からの7列の除去は RedefineTables ではなく DROP COLUMN で行う。
-- 前段のマイグレーションが足した列を CREATE TABLE の書き写しで取りこぼす事故
-- （AsbDefinition の4列欠落）を、そもそも起こしようがなくするため。

-- CreateTable
CREATE TABLE "AsbManuscriptPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "columns" INTEGER NOT NULL DEFAULT 20,
    "rows" INTEGER NOT NULL DEFAULT 10,
    "guideFontSize" REAL,
    "guidePosition" TEXT,
    "guidePadding" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbManuscriptPaper_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AsbManuscriptPaper_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AsbManuscriptPaper_subQuestionId_key" ON "AsbManuscriptPaper"("subQuestionId");
CREATE UNIQUE INDEX "AsbManuscriptPaper_branchQuestionId_key" ON "AsbManuscriptPaper"("branchQuestionId");
CREATE INDEX "AsbManuscriptPaper_subQuestionId_idx" ON "AsbManuscriptPaper"("subQuestionId");
CREATE INDEX "AsbManuscriptPaper_branchQuestionId_idx" ON "AsbManuscriptPaper"("branchQuestionId");

-- Backfill: 使われている小問の原稿用紙だけを行にする。
-- id は不透明な uuidv4（借用 id・合成 id は禁止。20260803110000_unify_ids_to_uuidv4 を参照）。
-- createdAt/updatedAt は driver adapter と同じ ISO text で入れる。
INSERT INTO "AsbManuscriptPaper" ("id", "subQuestionId", "branchQuestionId", "enabled", "columns", "rows", "guideFontSize", "guidePosition", "guidePadding", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    sq."id",
    NULL,
    sq."manuscriptEnabled",
    sq."manuscriptColumns",
    sq."manuscriptRows",
    sq."manuscriptGuideFontSize",
    sq."manuscriptGuidePosition",
    sq."manuscriptGuidePadding",
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM "AsbSubQuestion" sq
WHERE sq."manuscriptEnabled" <> 0
    OR sq."manuscriptColumns" <> 20
    OR sq."manuscriptRows" <> 10
    OR sq."manuscriptGuideFontSize" IS NOT NULL
    OR sq."manuscriptGuidePosition" IS NOT NULL
    OR sq."manuscriptGuidePadding" IS NOT NULL
    OR EXISTS (SELECT 1 FROM "AsbCharGuide" cg WHERE cg."subQuestionId" = sq."id");

-- RedefineTables: AsbCharGuide の親を小問から原稿用紙へ付け替える。
-- 列名と外部キーの両方が変わるため ALTER では届かず、作り直しになる。
-- id は据え置き（行の同一性は変わっていない）。
--
-- 作り直しの間、子の外部キー参照を黙らせているのは foreign_keys=OFF の方である。
-- defer_foreign_keys=ON は Prisma の定型に従って併記しているだけで、各文が自動コミットで
-- 走る（＝制約検査を遅らせる先のトランザクションが無い）この実行では実質無効。
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AsbCharGuide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manuscriptPaperId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "atChar" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "boundary" TEXT,
    "boundaryWidth" REAL,
    "boundaryDashRatio" REAL,
    "boundaryGapRatio" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbCharGuide_manuscriptPaperId_fkey" FOREIGN KEY ("manuscriptPaperId") REFERENCES "AsbManuscriptPaper" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AsbCharGuide" ("id", "manuscriptPaperId", "order", "atChar", "label", "boundary", "boundaryWidth", "boundaryDashRatio", "boundaryGapRatio", "createdAt", "updatedAt")
SELECT
    cg."id",
    mp."id",
    cg."order",
    cg."atChar",
    cg."label",
    cg."boundary",
    cg."boundaryWidth",
    cg."boundaryDashRatio",
    cg."boundaryGapRatio",
    cg."createdAt",
    cg."updatedAt"
FROM "AsbCharGuide" cg
JOIN "AsbManuscriptPaper" mp ON mp."subQuestionId" = cg."subQuestionId";
DROP TABLE "AsbCharGuide";
ALTER TABLE "new_AsbCharGuide" RENAME TO "AsbCharGuide";
CREATE INDEX "AsbCharGuide_manuscriptPaperId_idx" ON "AsbCharGuide"("manuscriptPaperId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- AlterTable: 原稿用紙の列を落とす。manuscriptCellSizeMm は cellHeight / rows から
-- 逆算する形へ変わって以来ずっと 0 が書かれていた廃止済みの列。
ALTER TABLE "AsbSubQuestion" DROP COLUMN "manuscriptEnabled";
ALTER TABLE "AsbSubQuestion" DROP COLUMN "manuscriptColumns";
ALTER TABLE "AsbSubQuestion" DROP COLUMN "manuscriptRows";
ALTER TABLE "AsbSubQuestion" DROP COLUMN "manuscriptCellSizeMm";
ALTER TABLE "AsbSubQuestion" DROP COLUMN "manuscriptGuideFontSize";
ALTER TABLE "AsbSubQuestion" DROP COLUMN "manuscriptGuidePosition";
ALTER TABLE "AsbSubQuestion" DROP COLUMN "manuscriptGuidePadding";
