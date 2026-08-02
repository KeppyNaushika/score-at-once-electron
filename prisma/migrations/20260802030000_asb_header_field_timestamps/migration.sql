-- AsbHeaderField に createdAt / updatedAt を足す。
--
-- sqlite-nas-sync は「`id` と `updatedAt` を持つ非内部テーブル」を同期対象として自動検出し、
-- 競合解決（LWW）にも updatedAt を使う。AsbHeaderField は全71モデルで唯一この2列を持たず、
-- 解答用紙定義を端末間で共有する際に、この表だけが同期から取り残される。
--
-- 既存行には**親 AsbDefinition の時刻をそのまま引き継ぐ**。移行を走らせた時刻を入れては
-- いけない。updatedAt は sync の LWW 判定に使われるので、端末ごとに違う「移行した時刻」が
-- 入ると、後からアップグレードした端末の**触ってもいない行**が、先にアップグレードした
-- 端末の実際の編集を上回って勝ってしまう（編集が黙って巻き戻る）。
--
-- 親の時刻が正しい値である理由: saveAsbDefinition は定義を delete → recreate する。
-- 子の id は定義側が持つ id をそのまま渡すので行の同一性は保たれ、ヘッダー項目が最後に
-- 書かれたのは「その定義が保存された時刻」＝ AsbDefinition.updatedAt に一致する。
-- 捏造ではなく事実を入れることになり、初回同期の LWW も実際の新しさで決まる。
--
-- ALTER TABLE ADD COLUMN は非定数の既定値（CURRENT_TIMESTAMP）を受け付けないので、
-- RedefineTables で作り直す。日時は ISO text で統一する
-- （integer/text 混在が範囲比較・ソート・sync LWW を壊すため）。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AsbHeaderField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "definitionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'field',
    "label" TEXT NOT NULL,
    "widthMm" REAL NOT NULL DEFAULT 30,
    "heightMm" REAL NOT NULL DEFAULT 8,
    "gridCount" INTEGER NOT NULL DEFAULT 0,
    "lineStyle" TEXT NOT NULL DEFAULT 'solid',
    "lineWidth" REAL NOT NULL DEFAULT 0.4,
    "order" INTEGER NOT NULL DEFAULT 0,
    "fontSize" REAL,
    "linkedRegionType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbHeaderField_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AsbDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_AsbHeaderField" ("id", "definitionId", "type", "label", "widthMm", "heightMm", "gridCount", "lineStyle", "lineWidth", "order", "fontSize", "linkedRegionType", "createdAt", "updatedAt")
SELECT
    "AsbHeaderField"."id",
    "AsbHeaderField"."definitionId",
    "AsbHeaderField"."type",
    "AsbHeaderField"."label",
    "AsbHeaderField"."widthMm",
    "AsbHeaderField"."heightMm",
    "AsbHeaderField"."gridCount",
    "AsbHeaderField"."lineStyle",
    "AsbHeaderField"."lineWidth",
    "AsbHeaderField"."order",
    "AsbHeaderField"."fontSize",
    "AsbHeaderField"."linkedRegionType",
    "AsbDefinition"."createdAt",
    "AsbDefinition"."updatedAt"
FROM "AsbHeaderField"
JOIN "AsbDefinition" ON "AsbDefinition"."id" = "AsbHeaderField"."definitionId";

DROP TABLE "AsbHeaderField";
ALTER TABLE "new_AsbHeaderField" RENAME TO "AsbHeaderField";

CREATE INDEX "AsbHeaderField_definitionId_idx" ON "AsbHeaderField"("definitionId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
