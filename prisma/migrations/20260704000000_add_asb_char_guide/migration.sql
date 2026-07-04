-- AsbSubQuestion.manuscriptCharGuides（JSON配列）を独立テーブル AsbCharGuide へ分離する（issue #913）。
-- 破壊的な DROP COLUMN を含むため、migrationDeployer が適用前にフルバックアップを取得し、
-- 例外時はファイルレベルで復元する。バックフィルは旧 parseCharGuides の取捨選択を厳密に再現するため、
-- 旧コードが無視していた不正エントリ以外は取りこぼさない（挙動リグレッションなし）。
-- 注意: migrationDeployer はセミコロンで文を分割するため、文内・コメント内にセミコロンを置かないこと。

-- CreateTable
CREATE TABLE "AsbCharGuide" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "atChar" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "boundary" TEXT,
    "boundaryWidth" REAL,
    "boundaryDashRatio" REAL,
    "boundaryGapRatio" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AsbCharGuide_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AsbCharGuide_subQuestionId_idx" ON "AsbCharGuide"("subQuestionId");

-- Backfill: manuscriptCharGuides の JSON配列を1行ずつ展開して移送する。
-- 旧 parseCharGuides の防御と一致させる:
--   * JSON が null / 空文字 / 不正 / 非配列 の行はスキップ（json_valid + json_type='array'）
--   * 各要素は object かつ atChar が数値 かつ label が文字列のもののみ採用
--   * boundary は solid/dashed/dotted 以外を NULL に落とす
--   * boundaryWidth / boundaryDashRatio / boundaryGapRatio は数値型でなければ NULL
-- order は元配列インデックス（json_each.key）。createdAt/updatedAt は driver adapter と同じ ISO text。
INSERT INTO "AsbCharGuide" ("id", "subQuestionId", "order", "atChar", "label", "boundary", "boundaryWidth", "boundaryDashRatio", "boundaryGapRatio", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))),
    sq."id",
    je."key",
    json_extract(je."value", '$.atChar'),
    json_extract(je."value", '$.label'),
    CASE WHEN json_extract(je."value", '$.boundary') IN ('solid', 'dashed', 'dotted') THEN json_extract(je."value", '$.boundary') ELSE NULL END,
    CASE WHEN typeof(json_extract(je."value", '$.boundaryWidth')) IN ('real', 'integer') THEN json_extract(je."value", '$.boundaryWidth') ELSE NULL END,
    CASE WHEN typeof(json_extract(je."value", '$.boundaryDashRatio')) IN ('real', 'integer') THEN json_extract(je."value", '$.boundaryDashRatio') ELSE NULL END,
    CASE WHEN typeof(json_extract(je."value", '$.boundaryGapRatio')) IN ('real', 'integer') THEN json_extract(je."value", '$.boundaryGapRatio') ELSE NULL END,
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM "AsbSubQuestion" sq, json_each(sq."manuscriptCharGuides") je
WHERE sq."manuscriptCharGuides" IS NOT NULL
    AND json_valid(sq."manuscriptCharGuides")
    AND json_type(sq."manuscriptCharGuides") = 'array'
    AND json_type(je."value") = 'object'
    AND typeof(json_extract(je."value", '$.atChar')) IN ('real', 'integer')
    AND typeof(json_extract(je."value", '$.label')) = 'text';

-- 移送完了後、旧 JSON 列を削除（SQLite 3.35+ の ALTER TABLE DROP COLUMN）。
ALTER TABLE "AsbSubQuestion" DROP COLUMN "manuscriptCharGuides";
