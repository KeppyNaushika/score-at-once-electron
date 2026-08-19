-- 利用者の設定のうち「組が繰り返すもの」を、UserPreference の JSON から行へ割る。
--
-- 対象は3キー。どれも1つの値の中に複数の組を畳んでいた:
--   * scoringStatusColors        … 状態7つ × 色3つ
--   * clickScoringConfig         … クリック回数 2/3/4 ごとの動作
--   * sidePanelCollapsedSections … 畳んでいる節の id の配列
--
-- 塊で読み書きすると、**続けて2つ変えたときに先の1つが消える**（取り直しが着地する前に、
-- 古い写しへ2度目を重ねて書くため）。行へ割れば別々の行を書くので、競合そのものが無くなる。
--
-- 保存値の剥がし方: `serializePreference` は文字列を JSON で1枚くるむので、中身の JSON へ
-- 届くには2段ある。`json_extract(value, '$')` は
--   * くるまれている（`"{\"a\":1}"`）なら中の文字列を返し、
--   * くるまれていない古い値（`{"a":1}`）ならそのまま返す
-- ので、両方をこれ1つで受けられる。壊れた値は `json_valid` で外す。
--
-- id は uuidv4 を SQL で作る。**各端末がこの移行を独立に走らせる**ので同じ設定に別々の
-- uuid が振られるが、`@@unique` 違反を sqlite-nas-sync が updatedAt の LWW で1行へ収束
-- させる（20260803110000 と同じ扱い）。同時刻タイで分岐しないよう、時刻はミリ秒まで書く。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── 1. テーブル作成 ─────────────────────────────────────────────
CREATE TABLE "UserScoringStatusColor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "backgroundColor" TEXT NOT NULL,
    "textColor" TEXT NOT NULL,
    "iconColor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserScoringStatusColor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "UserScoringStatusColor_userId_status_key" ON "UserScoringStatusColor"("userId", "status");
CREATE INDEX "UserScoringStatusColor_userId_idx" ON "UserScoringStatusColor"("userId");

CREATE TABLE "UserClickScoringAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserClickScoringAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "UserClickScoringAction_userId_clickCount_key" ON "UserClickScoringAction"("userId", "clickCount");
CREATE INDEX "UserClickScoringAction_userId_idx" ON "UserClickScoringAction"("userId");

CREATE TABLE "UserSidePanelSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "collapsed" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSidePanelSection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "UserSidePanelSection_userId_sectionId_key" ON "UserSidePanelSection"("userId", "sectionId");
CREATE INDEX "UserSidePanelSection_userId_idx" ON "UserSidePanelSection"("userId");

-- ── 2. 採点状態ごとの色を移す ───────────────────────────────────
-- 保存にある状態だけを行にする。無い状態は行を作らない（読む側が既定で埋める）。
-- 旧いキー `ungraded` は `unscored` として読む（読み出し側の扱いに合わせる）。
INSERT INTO "UserScoringStatusColor"
  ("id", "userId", "status", "backgroundColor", "textColor", "iconColor", "createdAt", "updatedAt")
SELECT
  lower(
    substr(hex(randomblob(4)), 1, 8) || '-' ||
    substr(hex(randomblob(2)), 1, 4) || '-4' ||
    substr(hex(randomblob(2)), 2, 3) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2, 3) || '-' ||
    substr(hex(randomblob(6)), 1, 12)
  ),
  "colors"."userId",
  "status"."name",
  json_extract("colors"."value", '$.' || "status"."key" || '.bg'),
  json_extract("colors"."value", '$.' || "status"."key" || '.text'),
  json_extract("colors"."value", '$.' || "status"."key" || '.icon'),
  strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
  strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM (
  SELECT "userId", json_extract("value", '$') AS "value"
  FROM "UserPreference"
  WHERE "key" = 'scoringStatusColors' AND json_valid("value")
) AS "colors"
JOIN (
  SELECT 'unscored' AS "name", 'unscored' AS "key"
  UNION ALL SELECT 'unscored', 'ungraded'
  UNION ALL SELECT 'correct', 'correct'
  UNION ALL SELECT 'incorrect', 'incorrect'
  UNION ALL SELECT 'partial', 'partial'
  UNION ALL SELECT 'pending', 'pending'
  UNION ALL SELECT 'no_answer', 'no_answer'
  UNION ALL SELECT 'double_mark', 'double_mark'
) AS "status"
WHERE json_valid("colors"."value")
  AND json_extract("colors"."value", '$.' || "status"."key" || '.bg') IS NOT NULL
  AND json_extract("colors"."value", '$.' || "status"."key" || '.text') IS NOT NULL
  AND json_extract("colors"."value", '$.' || "status"."key" || '.icon') IS NOT NULL
  -- 新旧のキーが両方あるときは新しい方を採る（unscored が2行になるのを防ぐ）
  AND NOT (
    "status"."key" = 'ungraded'
    AND json_extract("colors"."value", '$.unscored.bg') IS NOT NULL
  );

-- ── 3. クリック回数ごとの動作を移す ─────────────────────────────
INSERT INTO "UserClickScoringAction"
  ("id", "userId", "clickCount", "action", "createdAt", "updatedAt")
SELECT
  lower(
    substr(hex(randomblob(4)), 1, 8) || '-' ||
    substr(hex(randomblob(2)), 1, 4) || '-4' ||
    substr(hex(randomblob(2)), 2, 3) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2, 3) || '-' ||
    substr(hex(randomblob(6)), 1, 12)
  ),
  "config"."userId",
  "clicks"."count",
  json_extract("config"."value", '$."' || "clicks"."count" || '"'),
  strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
  strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM (
  SELECT "userId", json_extract("value", '$') AS "value"
  FROM "UserPreference"
  WHERE "key" = 'clickScoringConfig' AND json_valid("value")
) AS "config"
JOIN (
  SELECT 2 AS "count" UNION ALL SELECT 3 UNION ALL SELECT 4
) AS "clicks"
WHERE json_valid("config"."value")
  AND json_extract("config"."value", '$."' || "clicks"."count" || '"') IS NOT NULL;

-- ── 4. 畳んでいる節を移す ───────────────────────────────────────
-- 配列に入っている節だけを「畳んでいる」行にする（入っていない節は行を作らない）
INSERT INTO "UserSidePanelSection"
  ("id", "userId", "sectionId", "collapsed", "createdAt", "updatedAt")
SELECT
  lower(
    substr(hex(randomblob(4)), 1, 8) || '-' ||
    substr(hex(randomblob(2)), 1, 4) || '-4' ||
    substr(hex(randomblob(2)), 2, 3) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) ||
    substr(hex(randomblob(2)), 2, 3) || '-' ||
    substr(hex(randomblob(6)), 1, 12)
  ),
  "sections"."userId",
  "section"."value",
  1,
  strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
  strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM (
  SELECT "userId", json_extract("value", '$') AS "value"
  FROM "UserPreference"
  WHERE "key" = 'sidePanelCollapsedSections' AND json_valid("value")
) AS "sections"
JOIN json_each("sections"."value") AS "section"
WHERE json_type("sections"."value") = 'array'
  AND "section"."type" = 'text';

-- ── 5. 移し終えたキーを捨てる ───────────────────────────────────
DELETE FROM "UserPreference"
WHERE "key" IN (
  'scoringStatusColors',
  'clickScoringConfig',
  'sidePanelCollapsedSections'
);

PRAGMA foreign_keys=ON;
