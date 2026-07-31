-- 出力設定の JSON 埋め込み（ExamExportSettings.settingsJson）を RDB へ正規化する。
--
-- settingsJson は scoringMarkConfig（答案に重ねる要素の配置と見た目）と
-- individualReportOptions（個人成績表の内容）の2つを丸ごと抱えていた。
-- 同じ形の設定が4組（マーク・設問の点数・小計・合計）、状態ごとの真偽が7組ぶら下がり、
-- どれも SQL からは触れない塊になっていた。
--
-- 移行時の対応:
--  * anchor は新設。既存の見た目を変えないため、マークは position と同値、
--    点数は "middle-center"（描画側が textAlign/textBaseline を中央固定していたため）を入れる。
--  * 旧データの欠落は各既定値へ落とす。既定値はアプリ側の定義と一致させている。
--  * 後方互換キー（summaryScore / scorePosition 系）は、この移行でだけ読み、以後は捨てる。
--  * 未設定の試験（ExamExportSettings に行が無い）は行を作らない。読み出し側が既定値を使う。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ── 1. テーブル作成 ─────────────────────────────────────────────
CREATE TABLE "ExamAnswerOverlayStyle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "overlayKind" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "offsetX" INTEGER NOT NULL,
    "offsetY" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "opacity" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAnswerOverlayStyle_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ExamAnswerOverlayStyle_examId_overlayKind_key" ON "ExamAnswerOverlayStyle"("examId", "overlayKind");
CREATE INDEX "ExamAnswerOverlayStyle_examId_idx" ON "ExamAnswerOverlayStyle"("examId");

CREATE TABLE "ExamAnswerOverlayVisibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "showMark" BOOLEAN NOT NULL,
    "showScore" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAnswerOverlayVisibility_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ExamAnswerOverlayVisibility_examId_status_key" ON "ExamAnswerOverlayVisibility"("examId", "status");
CREATE INDEX "ExamAnswerOverlayVisibility_examId_idx" ON "ExamAnswerOverlayVisibility"("examId");

CREATE TABLE "ExamIndividualReportSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "displayMode" TEXT NOT NULL,
    "showScore" BOOLEAN NOT NULL,
    "showMarks" BOOLEAN NOT NULL,
    "hideUnassignedSubtotals" BOOLEAN NOT NULL,
    "showGroupSubtotals" BOOLEAN NOT NULL,
    "showCorrectRate" BOOLEAN NOT NULL,
    "showScoreRate" BOOLEAN NOT NULL,
    "showLearningAdvice" BOOLEAN NOT NULL,
    "adviceReviewRateMin" REAL,
    "adviceReviewRateMax" REAL,
    "adviceReviewQuestionCount" INTEGER,
    "showComment" BOOLEAN NOT NULL,
    "showSignature" BOOLEAN NOT NULL,
    "pageLayout" TEXT NOT NULL,
    "pageOrientation" TEXT NOT NULL,
    "tableGroupSelectionEnabled" BOOLEAN NOT NULL,
    "statisticsIncludesParticipating" BOOLEAN NOT NULL,
    "statisticsIncludesExpected" BOOLEAN NOT NULL,
    "statisticsIncludesAbsent" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportSettings_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ExamIndividualReportSettings_examId_key" ON "ExamIndividualReportSettings"("examId");

CREATE TABLE "ExamIndividualReportTableSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "tableKind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "columns" INTEGER NOT NULL,
    "fontSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportTableSection_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ExamIndividualReportTableSection_examId_tableKind_key" ON "ExamIndividualReportTableSection"("examId", "tableKind");
CREATE INDEX "ExamIndividualReportTableSection_examId_idx" ON "ExamIndividualReportTableSection"("examId");

CREATE TABLE "ExamIndividualReportGraphSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "showBarChart" BOOLEAN NOT NULL,
    "showRadarChart" BOOLEAN NOT NULL,
    "showTotalScoreBoxPlot" BOOLEAN NOT NULL,
    "boxPlotGroupSelectionEnabled" BOOLEAN NOT NULL,
    "showBoxPlotMin" BOOLEAN NOT NULL,
    "showBoxPlotQ1" BOOLEAN NOT NULL,
    "showBoxPlotMedian" BOOLEAN NOT NULL,
    "showBoxPlotQ3" BOOLEAN NOT NULL,
    "showBoxPlotMax" BOOLEAN NOT NULL,
    "showAverageLine" BOOLEAN NOT NULL,
    "showStudentMarker" BOOLEAN NOT NULL,
    "boxPlotFontSize" INTEGER NOT NULL,
    "boxPlotItemHeight" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportGraphSettings_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ExamIndividualReportGraphSettings_examId_key" ON "ExamIndividualReportGraphSettings"("examId");

-- ── 2. 重ね描き要素のスタイルを移す ─────────────────────────────
-- マーク: anchor は position と同値（旧実装は position が示す点に画像の同じ点を合わせていた）
INSERT INTO "ExamAnswerOverlayStyle"
  ("id", "examId", "overlayKind", "position", "anchor", "offsetX", "offsetY", "size", "color", "opacity")
SELECT
  "examId" || ':mark',
  "examId",
  'mark',
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.markPosition'), 'middle-center'),
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.markPosition'), 'middle-center'),
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.markOffsetX'), 0),
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.markOffsetY'), 0),
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.markSize'), 50),
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.markColor'), '#ef4444'),
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.markOpacity'), 100)
FROM "ExamExportSettings"
WHERE json_valid("settingsJson");

-- 設問の点数: partialScore → 旧 score* → 既定 の順に拾う
INSERT INTO "ExamAnswerOverlayStyle"
  ("id", "examId", "overlayKind", "position", "anchor", "offsetX", "offsetY", "size", "color", "opacity")
SELECT
  "examId" || ':partial',
  "examId",
  'partial',
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.partialScore.position'),
    json_extract("settingsJson", '$.scoringMarkConfig.scorePosition'),
    'middle-center'),
  'middle-center',
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.partialScore.offsetX'),
    json_extract("settingsJson", '$.scoringMarkConfig.scoreOffsetX'), 0),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.partialScore.offsetY'),
    json_extract("settingsJson", '$.scoringMarkConfig.scoreOffsetY'), 0),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.partialScore.size'),
    json_extract("settingsJson", '$.scoringMarkConfig.scoreSize'), 14),
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.partialScore.color'), '#ef4444'),
  COALESCE(json_extract("settingsJson", '$.scoringMarkConfig.partialScore.opacity'), 100)
FROM "ExamExportSettings"
WHERE json_valid("settingsJson");

-- 小計: subtotalScore → summaryScore → 既定
INSERT INTO "ExamAnswerOverlayStyle"
  ("id", "examId", "overlayKind", "position", "anchor", "offsetX", "offsetY", "size", "color", "opacity")
SELECT
  "examId" || ':subtotal',
  "examId",
  'subtotal',
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.subtotalScore.position'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.position'),
    'middle-center'),
  'middle-center',
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.subtotalScore.offsetX'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.offsetX'), 0),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.subtotalScore.offsetY'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.offsetY'), 0),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.subtotalScore.size'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.size'), 18),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.subtotalScore.color'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.color'), '#2563eb'),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.subtotalScore.opacity'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.opacity'), 100)
FROM "ExamExportSettings"
WHERE json_valid("settingsJson");

-- 合計: totalScore → summaryScore → 既定
INSERT INTO "ExamAnswerOverlayStyle"
  ("id", "examId", "overlayKind", "position", "anchor", "offsetX", "offsetY", "size", "color", "opacity")
SELECT
  "examId" || ':total',
  "examId",
  'total',
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.totalScore.position'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.position'),
    'middle-center'),
  'middle-center',
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.totalScore.offsetX'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.offsetX'), 0),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.totalScore.offsetY'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.offsetY'), 0),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.totalScore.size'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.size'), 18),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.totalScore.color'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.color'), '#16a34a'),
  COALESCE(
    json_extract("settingsJson", '$.scoringMarkConfig.totalScore.opacity'),
    json_extract("settingsJson", '$.scoringMarkConfig.summaryScore.opacity'), 100)
FROM "ExamExportSettings"
WHERE json_valid("settingsJson");

-- ── 3. 採点状態ごとの可視性を移す ───────────────────────────────
INSERT INTO "ExamAnswerOverlayVisibility"
  ("id", "examId", "status", "showMark", "showScore")
SELECT
  settings."examId" || ':' || scoringStatus."status",
  settings."examId",
  scoringStatus."status",
  COALESCE(
    json_extract(settings."settingsJson", '$.scoringMarkConfig.showMarkForStatus.' || scoringStatus."status"),
    scoringStatus."defaultShow"),
  COALESCE(
    json_extract(settings."settingsJson", '$.scoringMarkConfig.showScoreForStatus.' || scoringStatus."status"),
    scoringStatus."defaultShow")
FROM "ExamExportSettings" settings
CROSS JOIN (
  SELECT 'unscored' AS "status", 0 AS "defaultShow"
  UNION ALL SELECT 'correct', 1
  UNION ALL SELECT 'incorrect', 1
  UNION ALL SELECT 'partial', 1
  UNION ALL SELECT 'pending', 1
  UNION ALL SELECT 'no_answer', 1
  UNION ALL SELECT 'double_mark', 1
) scoringStatus
WHERE json_valid(settings."settingsJson");

-- ── 4. 個人成績表の設定を移す ───────────────────────────────────
INSERT INTO "ExamIndividualReportSettings" (
  "id", "examId", "displayMode", "showScore", "showMarks",
  "hideUnassignedSubtotals", "showGroupSubtotals", "showCorrectRate", "showScoreRate",
  "showLearningAdvice", "adviceReviewRateMin", "adviceReviewRateMax", "adviceReviewQuestionCount",
  "showComment", "showSignature", "pageLayout", "pageOrientation",
  "tableGroupSelectionEnabled",
  "statisticsIncludesParticipating", "statisticsIncludesExpected", "statisticsIncludesAbsent"
)
SELECT
  "examId",
  "examId",
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.displayMode'), 'detail'),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showScore'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showMarks'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.hideUnassignedSubtotals'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showGroupSubtotals'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showCorrectRate'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showScoreRate'), 0),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showLearningAdvice'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.adviceOptions.reviewRateMin'), 70),
  json_extract("settingsJson", '$.individualReportOptions.adviceOptions.reviewRateMax'),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.adviceOptions.reviewQuestionCount'), 5),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showComment'), 0),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showSignature'), 0),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.pageLayout'), 'auto'),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.pageOrientation'), 'portrait'),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.tableSubtotalGroupSelection.enabled'), 0),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.boxPlotIncludeStatuses.participating'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.boxPlotIncludeStatuses.expected'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.boxPlotIncludeStatuses.absent'), 0)
FROM "ExamExportSettings"
WHERE json_valid("settingsJson");

-- ── 5. 表形式の節を移す ─────────────────────────────────────────
INSERT INTO "ExamIndividualReportTableSection"
  ("id", "examId", "tableKind", "enabled", "columns", "fontSize")
SELECT
  "examId" || ':subtotal',
  "examId",
  'subtotal',
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showSubtotalTable'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.subtotalTableColumns'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.subtotalTableFontSize'), 10)
FROM "ExamExportSettings"
WHERE json_valid("settingsJson");

INSERT INTO "ExamIndividualReportTableSection"
  ("id", "examId", "tableKind", "enabled", "columns", "fontSize")
SELECT
  "examId" || ':question',
  "examId",
  'question',
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.showQuestionTable'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.questionTableColumns'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.questionTableFontSize'), 10)
FROM "ExamExportSettings"
WHERE json_valid("settingsJson");

-- ── 6. 統計の可視性（種別 × 母集団）を移す ──────────────────────
-- 旧形式は平均を4値文字列（class/overall/both/none）、順位を真偽＋3値文字列という
-- 別々の詰め方で表していた。どちらも「所属学級ごと」「全体」の2つの独立した真偽なので展開する。
-- 学級ごとの偏差値・箱ひげ図は旧形式に存在しないため false で始める。
CREATE TABLE "ExamIndividualReportStatisticVisibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "statisticKind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "shown" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamIndividualReportStatisticVisibility_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "ExamIndividualReportStatisticVisibility_examId_statisticKind_scope_key" ON "ExamIndividualReportStatisticVisibility"("examId", "statisticKind", "scope");
CREATE INDEX "ExamIndividualReportStatisticVisibility_examId_idx" ON "ExamIndividualReportStatisticVisibility"("examId");

INSERT INTO "ExamIndividualReportStatisticVisibility"
  ("id", "examId", "statisticKind", "scope", "shown")
SELECT
  settings."examId" || ':' || cell."statisticKind" || ':' || cell."scope",
  settings."examId",
  cell."statisticKind",
  cell."scope",
  CASE
    WHEN cell."statisticKind" = 'average' AND cell."scope" = 'classroom' THEN
      COALESCE(json_extract(settings."settingsJson", '$.individualReportOptions.showAverage'), 'both') IN ('class', 'both')
    WHEN cell."statisticKind" = 'average' AND cell."scope" = 'overall' THEN
      COALESCE(json_extract(settings."settingsJson", '$.individualReportOptions.showAverage'), 'both') IN ('overall', 'both')
    WHEN cell."statisticKind" = 'deviation' AND cell."scope" = 'overall' THEN
      COALESCE(json_extract(settings."settingsJson", '$.individualReportOptions.showDeviation'), 1)
    WHEN cell."statisticKind" = 'rank' AND cell."scope" = 'classroom' THEN
      COALESCE(json_extract(settings."settingsJson", '$.individualReportOptions.showRank'), 1)
      AND COALESCE(json_extract(settings."settingsJson", '$.individualReportOptions.rankType'), 'both') IN ('class', 'both')
    WHEN cell."statisticKind" = 'rank' AND cell."scope" = 'overall' THEN
      COALESCE(json_extract(settings."settingsJson", '$.individualReportOptions.showRank'), 1)
      AND COALESCE(json_extract(settings."settingsJson", '$.individualReportOptions.rankType'), 'both') IN ('overall', 'both')
    WHEN cell."statisticKind" = 'boxPlot' AND cell."scope" = 'overall' THEN
      COALESCE(json_extract(settings."settingsJson", '$.individualReportOptions.graphOptions.showBoxPlot'), 1)
    ELSE 0
  END
FROM "ExamExportSettings" settings
CROSS JOIN (
  SELECT 'average' AS "statisticKind", 'classroom' AS "scope"
  UNION ALL SELECT 'average', 'overall'
  UNION ALL SELECT 'deviation', 'classroom'
  UNION ALL SELECT 'deviation', 'overall'
  UNION ALL SELECT 'rank', 'classroom'
  UNION ALL SELECT 'rank', 'overall'
  UNION ALL SELECT 'boxPlot', 'classroom'
  UNION ALL SELECT 'boxPlot', 'overall'
) cell
WHERE json_valid(settings."settingsJson");

-- ── 7. グラフ設定を移す ─────────────────────────────────────────
INSERT INTO "ExamIndividualReportGraphSettings" (
  "id", "examId", "showBarChart", "showRadarChart", "showTotalScoreBoxPlot", "boxPlotGroupSelectionEnabled",
  "showBoxPlotMin", "showBoxPlotQ1", "showBoxPlotMedian", "showBoxPlotQ3", "showBoxPlotMax",
  "showAverageLine", "showStudentMarker", "boxPlotFontSize", "boxPlotItemHeight"
)
SELECT
  "examId",
  "examId",
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showBarChart'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showRadarChart'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showOverallBoxPlot'), 0),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.boxPlotSubtotalGroupSelection.enabled'), 0),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showBoxPlotMin'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showBoxPlotQ1'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showBoxPlotMedian'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showBoxPlotQ3'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showBoxPlotMax'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showAverageLine'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.showStudentMarker'), 1),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.boxPlotFontSize'), 11),
  COALESCE(json_extract("settingsJson", '$.individualReportOptions.graphOptions.boxPlotItemHeight'), 20)
FROM "ExamExportSettings"
WHERE json_valid("settingsJson");

-- ── 8. 移行できなかった行を記録する ─────────────────────────────
-- settingsJson が壊れている行は上の INSERT が拾わない。黙って落とさず監査に残す。
INSERT INTO "AuditLog"
  ("id", "action", "category", "entityType", "entityId", "summary", "createdAt", "updatedAt")
SELECT
  "examId" || ':export-settings-migration',
  'exam.export_settings.migrate_failed',
  'exam',
  'ExamExportSettings',
  "examId",
  '出力設定のJSONが壊れていたため既定値へ戻しました',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ExamExportSettings"
WHERE NOT json_valid("settingsJson");

-- ── 9. 旧テーブルを削除 ─────────────────────────────────────────
DROP TABLE "ExamExportSettings";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
