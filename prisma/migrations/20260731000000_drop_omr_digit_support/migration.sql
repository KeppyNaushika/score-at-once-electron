-- 手書き数字認識のスキーマを撤去する（#1103 / #1104 の残作業）。
--
-- 実データによる検証で採点に耐えないことが判明し、認識エンジンごと削除された（#1103）。
-- 機能が前提としていた「桁ごとの数字枠」は一度も使われておらず（CropRegionOmrDigitBox 0 件）、
-- digit 設定も 1 件しか存在しない。コードからの参照は #1104 で 0 になっている。
--
-- type <> 'choice' の行は、numDigits / correctAnswer を落とすと
-- 「選択式でもなく桁数も正答も持たない」行になり、どちらの設定としても解釈できない。
-- アプリ側は既に選択式以外を「OMR設定なし」として無視しているため（dbToOmrConfig）、
-- 列を落とす前にその行自体を削除して中途半端な状態を残さない。
-- 子の ChoiceOption は digit 設定には存在しないが、cascade で追随する。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── 1. 廃止された digit 設定の行を削除 ───────────────────────────
DELETE FROM "CropRegionOmrConfig" WHERE "type" <> 'choice';
DELETE FROM "AsbOmrConfig" WHERE "type" <> 'choice';

-- ── 2. OMR数字枠テーブルを削除 ──────────────────────────────────
DROP TABLE IF EXISTS "CropRegionOmrDigitBox";

-- ── 3. CropRegionOmrConfig から numDigits / correctAnswer を落とす ──
CREATE TABLE "new_CropRegionOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cropRegionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "colorThreshold" INTEGER,
    "areaThreshold" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CropRegionOmrConfig_cropRegionId_fkey" FOREIGN KEY ("cropRegionId") REFERENCES "CropRegion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_CropRegionOmrConfig" ("id", "cropRegionId", "type", "numChoices", "choiceLayout", "colorThreshold", "areaThreshold", "createdAt", "updatedAt")
SELECT "id", "cropRegionId", "type", "numChoices", "choiceLayout", "colorThreshold", "areaThreshold", "createdAt", "updatedAt"
FROM "CropRegionOmrConfig";
DROP TABLE "CropRegionOmrConfig";
ALTER TABLE "new_CropRegionOmrConfig" RENAME TO "CropRegionOmrConfig";
CREATE UNIQUE INDEX "CropRegionOmrConfig_cropRegionId_key" ON "CropRegionOmrConfig"("cropRegionId");
CREATE INDEX "CropRegionOmrConfig_cropRegionId_idx" ON "CropRegionOmrConfig"("cropRegionId");

-- ── 4. AsbOmrConfig から numDigits / correctAnswer を落とす ─────────
CREATE TABLE "new_AsbOmrConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subQuestionId" TEXT,
    "branchQuestionId" TEXT,
    "type" TEXT NOT NULL,
    "numChoices" INTEGER,
    "choiceLayout" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsbOmrConfig_subQuestionId_fkey" FOREIGN KEY ("subQuestionId") REFERENCES "AsbSubQuestion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "AsbOmrConfig_branchQuestionId_fkey" FOREIGN KEY ("branchQuestionId") REFERENCES "AsbBranchQuestion" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO "new_AsbOmrConfig" ("id", "subQuestionId", "branchQuestionId", "type", "numChoices", "choiceLayout", "createdAt", "updatedAt")
SELECT "id", "subQuestionId", "branchQuestionId", "type", "numChoices", "choiceLayout", "createdAt", "updatedAt"
FROM "AsbOmrConfig";
DROP TABLE "AsbOmrConfig";
ALTER TABLE "new_AsbOmrConfig" RENAME TO "AsbOmrConfig";
CREATE UNIQUE INDEX "AsbOmrConfig_subQuestionId_key" ON "AsbOmrConfig"("subQuestionId");
CREATE UNIQUE INDEX "AsbOmrConfig_branchQuestionId_key" ON "AsbOmrConfig"("branchQuestionId");
CREATE INDEX "AsbOmrConfig_subQuestionId_idx" ON "AsbOmrConfig"("subQuestionId");
CREATE INDEX "AsbOmrConfig_branchQuestionId_idx" ON "AsbOmrConfig"("branchQuestionId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
