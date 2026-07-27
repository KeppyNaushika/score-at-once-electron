-- 観点間の制約ルールの設定JSON（GradeConstraint.config）と、欠損推定の参照配列
-- （GradeDataSource.estimationSourceIds）を正規化テーブルへ分離する（issue #1063）。
--
-- 旧 config は評価項目を「名前」で参照していたため、項目をリネームすると制約が失効した。
-- 比較先（target）の失効は検証されて画面に出るが、集計対象（viewpointItems）の失効は
-- 検証されず、一部だけ空振りすると残った項目だけで平均を取って判定が通っていた。
-- estimationSourceIds は FK が効かず、参照先削除後も dangling id が残っていた。
--
-- 新テーブルのidは決定論的な合成キー（親id + ':' + 子キー）にする。`@default(uuid())`
-- 相当だと2端末が同じペアを作ったときにid違い・UNIQUE同値の行ができてNAS同期で衝突する。
-- 同一idなら行レベルLWWで1行へ収束する。SQLだけで再現できる必要があるため、
-- CropRegionAssignment の uuidv5 ではなく合成キーを採る。

-- CreateTable: consistency ルールの集計対象となる観点（旧 config.viewpointItems）
CREATE TABLE "GradeConstraintViewpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "constraintId" TEXT NOT NULL,
    "gradeItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeConstraintViewpoint_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "GradeConstraint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeConstraintViewpoint_gradeItemId_fkey" FOREIGN KEY ("gradeItemId") REFERENCES "GradeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeConstraintViewpoint_constraintId_gradeItemId_key" ON "GradeConstraintViewpoint"("constraintId", "gradeItemId");

-- CreateIndex
CREATE INDEX "GradeConstraintViewpoint_constraintId_idx" ON "GradeConstraintViewpoint"("constraintId");

-- CreateIndex
CREATE INDEX "GradeConstraintViewpoint_gradeItemId_idx" ON "GradeConstraintViewpoint"("gradeItemId");

-- CreateTable: consistency ルールのラベル→数値の対応（旧 config.labelValues）
CREATE TABLE "GradeConstraintLabelValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "constraintId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeConstraintLabelValue_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "GradeConstraint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeConstraintLabelValue_constraintId_label_key" ON "GradeConstraintLabelValue"("constraintId", "label");

-- CreateIndex
CREATE INDEX "GradeConstraintLabelValue_constraintId_idx" ON "GradeConstraintLabelValue"("constraintId");

-- CreateTable: mutual_exclusion ルールの混在禁止ラベル集合（旧 config.labels）
CREATE TABLE "GradeConstraintExclusionLabel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "constraintId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeConstraintExclusionLabel_constraintId_fkey" FOREIGN KEY ("constraintId") REFERENCES "GradeConstraint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeConstraintExclusionLabel_constraintId_label_key" ON "GradeConstraintExclusionLabel"("constraintId", "label");

-- CreateIndex
CREATE INDEX "GradeConstraintExclusionLabel_constraintId_idx" ON "GradeConstraintExclusionLabel"("constraintId");

-- CreateTable: 欠損推定に使う他データソース（旧 GradeDataSource.estimationSourceIds）
CREATE TABLE "GradeDataSourceEstimationSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataSourceId" TEXT NOT NULL,
    "sourceDataSourceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeDataSourceEstimationSource_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "GradeDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GradeDataSourceEstimationSource_sourceDataSourceId_fkey" FOREIGN KEY ("sourceDataSourceId") REFERENCES "GradeDataSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GradeDataSourceEstimationSource_dataSourceId_sourceDataSourceId_key" ON "GradeDataSourceEstimationSource"("dataSourceId", "sourceDataSourceId");

-- CreateIndex
CREATE INDEX "GradeDataSourceEstimationSource_dataSourceId_idx" ON "GradeDataSourceEstimationSource"("dataSourceId");

-- CreateIndex
CREATE INDEX "GradeDataSourceEstimationSource_sourceDataSourceId_idx" ON "GradeDataSourceEstimationSource"("sourceDataSourceId");

-- AlterTable: 比較先・集計方法・許容差をスカラー列へ昇格する。
-- 評価項目を削除したときは NULL にしてルール自体は残し、「評定が未選択」として
-- 検知させる（黙って違反なしにしない）。
ALTER TABLE "GradeConstraint" ADD COLUMN "targetGradeItemId" TEXT REFERENCES "GradeItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GradeConstraint" ADD COLUMN "aggregate" TEXT NOT NULL DEFAULT 'average';
ALTER TABLE "GradeConstraint" ADD COLUMN "tolerance" DECIMAL NOT NULL DEFAULT 1;
-- 自動で無効化したときの理由。message（教員が書いた違反の説明で結果表のツールチップに
-- 出る）へ診断文を混ぜると、再設定後も違反理由として表示され続けるため別列に置く。
ALTER TABLE "GradeConstraint" ADD COLUMN "disabledReason" TEXT;

-- CreateIndex
CREATE INDEX "GradeConstraint_targetGradeItemId_idx" ON "GradeConstraint"("targetGradeItemId");

-- 比較先（config.target）を名前から id へ解決する。
-- GradeItem.name に一意制約は無いので同名が複数ありうる。どれか1つを推測で選ぶと
-- 誤った項目と比較して誤った生徒を着色するため、曖昧なときは解決しない
-- （アーカイブ取込の resolveGradeItemId と同じ扱い。両経路で結果を一致させる）。
UPDATE "GradeConstraint"
SET "targetGradeItemId" = (
    SELECT "gradeItem"."id"
    FROM "GradeItem" AS "gradeItem"
    WHERE "gradeItem"."gradeId" = "GradeConstraint"."gradeId"
      AND "gradeItem"."name" = json_extract("GradeConstraint"."config", '$.target')
)
WHERE "kind" = 'consistency'
  AND json_valid("config")
  AND json_extract("config", '$.target') IS NOT NULL
  AND (
    SELECT COUNT(*)
    FROM "GradeItem" AS "gradeItem"
    WHERE "gradeItem"."gradeId" = "GradeConstraint"."gradeId"
      AND "gradeItem"."name" = json_extract("GradeConstraint"."config", '$.target')
  ) = 1;

-- 集計方法・許容差をスカラー列へ移す
UPDATE "GradeConstraint"
SET "aggregate" = COALESCE(json_extract("config", '$.aggregate'), 'average'),
    "tolerance" = COALESCE(json_extract("config", '$.tolerance'), 1)
WHERE json_valid("config");

-- 集計対象の観点（config.viewpointItems）を名前から id へ解決して移す。
--
-- 比較先と違い、同名の項目が複数あっても全て集計対象にする。旧実装の判定は
-- `selected.includes(viewpoint.name)` で同名項目を両方とも集計していたため、
-- ここで落とすと移行が既存の判定を変えてしまう（集計対象は複数選べるので
-- 取り違えにもならない）。比較先は1つしか選べないため曖昧なら解決しない。
--
-- 解決できない名前は行を作れない（FKで守るため）。取りこぼしは後段で検知して無効化する。
INSERT INTO "GradeConstraintViewpoint" ("id", "constraintId", "gradeItemId", "order", "createdAt", "updatedAt")
SELECT
    "constraint"."id" || ':' || "gradeItem"."id",
    "constraint"."id",
    "gradeItem"."id",
    CAST("element"."key" AS INTEGER),
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM "GradeConstraint" AS "constraint"
JOIN json_each(json_extract("constraint"."config", '$.viewpointItems')) AS "element"
JOIN "GradeItem" AS "gradeItem"
  ON "gradeItem"."gradeId" = "constraint"."gradeId"
 AND "gradeItem"."name" = "element"."value"
WHERE "constraint"."kind" = 'consistency'
  AND json_valid("constraint"."config")
  AND json_type("constraint"."config", '$.viewpointItems') = 'array'
GROUP BY "constraint"."id", "gradeItem"."id";

-- ラベル→数値の対応（config.labelValues）を移す。
-- 旧データはオブジェクトなので配列のような添字を持たない。json_each の走査順に
-- 0始まりの連番を振り直す（走査idをそのまま使うと値が飛ぶ）。
INSERT INTO "GradeConstraintLabelValue" ("id", "constraintId", "label", "value", "order", "createdAt", "updatedAt")
SELECT
    "labelValue"."constraintId" || ':' || "labelValue"."label",
    "labelValue"."constraintId",
    "labelValue"."label",
    "labelValue"."value",
    ROW_NUMBER() OVER (PARTITION BY "labelValue"."constraintId" ORDER BY "labelValue"."scanOrder") - 1,
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM (
    SELECT
        "constraint"."id" AS "constraintId",
        "element"."key" AS "label",
        "element"."value" AS "value",
        "element"."id" AS "scanOrder"
    FROM "GradeConstraint" AS "constraint"
    JOIN json_each(json_extract("constraint"."config", '$.labelValues')) AS "element"
    WHERE json_valid("constraint"."config")
      AND json_type("constraint"."config", '$.labelValues') = 'object'
      AND "element"."type" IN ('integer', 'real')
) AS "labelValue";

-- 混在禁止ラベル（config.labels）を移す
INSERT INTO "GradeConstraintExclusionLabel" ("id", "constraintId", "label", "order", "createdAt", "updatedAt")
SELECT
    "constraint"."id" || ':' || "element"."value",
    "constraint"."id",
    "element"."value",
    CAST("element"."key" AS INTEGER),
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM "GradeConstraint" AS "constraint"
JOIN json_each(json_extract("constraint"."config", '$.labels')) AS "element"
WHERE "constraint"."kind" = 'mutual_exclusion'
  AND json_valid("constraint"."config")
  AND json_type("constraint"."config", '$.labels') = 'array'
  AND "element"."type" = 'text'
GROUP BY "constraint"."id", "element"."value";

-- ラベル→数値の既定値を補う。
-- 旧実装の parseConfig は既定値 {A:5,B:3,C:1} に config をマージしていたため、
-- labelValues が欠けた（あるいは壊れた）configでも Excel 流のスケールで評価されていた。
-- 移行後は行が無いと順位換算へ落ちて判定が変わるので、1行も入らなかった
-- consistency ルールには既定値を入れて従来の判定を保つ。
INSERT INTO "GradeConstraintLabelValue" ("id", "constraintId", "label", "value", "order", "createdAt", "updatedAt")
SELECT
    "constraint"."id" || ':' || "fallback"."label",
    "constraint"."id",
    "fallback"."label",
    "fallback"."value",
    "fallback"."order",
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM "GradeConstraint" AS "constraint"
JOIN (
    SELECT 'A' AS "label", 5 AS "value", 0 AS "order"
    UNION ALL SELECT 'B', 3, 1
    UNION ALL SELECT 'C', 1, 2
) AS "fallback"
WHERE "constraint"."kind" = 'consistency'
  AND NOT EXISTS (
    SELECT 1
    FROM "GradeConstraintLabelValue" AS "labelValue"
    WHERE "labelValue"."constraintId" = "constraint"."id"
  );

-- 混在禁止ラベルの既定値も同様に補う（旧既定値は ["A","C"]）。
INSERT INTO "GradeConstraintExclusionLabel" ("id", "constraintId", "label", "order", "createdAt", "updatedAt")
SELECT
    "constraint"."id" || ':' || "fallback"."label",
    "constraint"."id",
    "fallback"."label",
    "fallback"."order",
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM "GradeConstraint" AS "constraint"
JOIN (
    SELECT 'A' AS "label", 0 AS "order"
    UNION ALL SELECT 'C', 1
) AS "fallback"
WHERE "constraint"."kind" = 'mutual_exclusion'
  AND NOT EXISTS (
    SELECT 1
    FROM "GradeConstraintExclusionLabel" AS "exclusionLabel"
    WHERE "exclusionLabel"."constraintId" = "constraint"."id"
  );

-- 取りこぼしの検知: 比較先の名前があったのに解決できなかった consistency ルールを無効化する。
-- 黙って「違反なし」に化けるのを避け、利用者に再設定を促す。
-- 理由は disabledReason へ書く（message は教員が書いた違反の説明で、結果表の
-- ツールチップに出るため汚さない）。
UPDATE "GradeConstraint"
SET "enabled" = 0,
    "disabledReason" = '移行時に比較先の評価項目「' || json_extract("config", '$.target') || '」を解決できなかったため無効化しました。同名の評価項目が複数ある場合も解決できません。再設定してください。'
WHERE "kind" = 'consistency'
  AND json_valid("config")
  AND json_extract("config", '$.target') IS NOT NULL
  AND json_extract("config", '$.target') <> ''
  AND "targetGradeItemId" IS NULL;

-- 取りこぼしの検知: 集計対象が指定されていたのに一部でも解決できなかったルールを無効化する。
-- 黙って「指定なし（＝比較先以外の全項目）」へ化けると判定の意味が変わるため。
--
-- 判定は行数ではなく「名前が何種類解決できたか」で行う。挿入側は
-- (constraint, gradeItem) で GROUP BY しており、同名項目が複数あると名前1つが
-- 複数行になるため、配列長と行数を直接比べると取りこぼしが無くても食い違う。
UPDATE "GradeConstraint"
SET "enabled" = 0,
    "disabledReason" = '移行時に集計対象の観点を解決できなかったため無効化しました。再設定してください。'
WHERE "kind" = 'consistency'
  AND json_valid("config")
  AND json_type("config", '$.viewpointItems') = 'array'
  AND json_array_length("config", '$.viewpointItems') > 0
  AND (
      SELECT COUNT(DISTINCT "element"."value")
      FROM json_each(json_extract("GradeConstraint"."config", '$.viewpointItems')) AS "element"
  ) <> (
      SELECT COUNT(DISTINCT "element"."value")
      FROM json_each(json_extract("GradeConstraint"."config", '$.viewpointItems')) AS "element"
      WHERE EXISTS (
        SELECT 1
        FROM "GradeItem" AS "gradeItem"
        WHERE "gradeItem"."gradeId" = "GradeConstraint"."gradeId"
          AND "gradeItem"."name" = "element"."value"
      )
  );

-- 欠損推定の参照（estimationSourceIds）を移す。
-- 実在しない参照（dangling id）は JOIN で落ちる。これが排除したかった状態そのもの。
INSERT INTO "GradeDataSourceEstimationSource" ("id", "dataSourceId", "sourceDataSourceId", "order", "createdAt", "updatedAt")
SELECT
    "dataSource"."id" || ':' || "source"."id",
    "dataSource"."id",
    "source"."id",
    CAST("element"."key" AS INTEGER),
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00',
    strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00'
FROM "GradeDataSource" AS "dataSource"
JOIN json_each("dataSource"."estimationSourceIds") AS "element"
JOIN "GradeDataSource" AS "source" ON "source"."id" = "element"."value"
WHERE json_valid("dataSource"."estimationSourceIds")
  AND json_type("dataSource"."estimationSourceIds") = 'array'
  AND "source"."id" <> "dataSource"."id"
GROUP BY "dataSource"."id", "source"."id";

-- DropColumn: JSON埋め込みを撤去する
ALTER TABLE "GradeConstraint" DROP COLUMN "config";
ALTER TABLE "GradeDataSource" DROP COLUMN "estimationSourceIds";
