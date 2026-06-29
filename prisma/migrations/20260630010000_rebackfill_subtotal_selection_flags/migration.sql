-- 20260629140000 の再バックフィル（enabled 条件を外して整合させる）
--
-- 旧移行は settingsJson の enabled=1 の選択のみフラグ化していたが、実行時の
-- setSubtotalGroupSelection は enabled に関係なく「フラグ＝選択ID」を書き込む
-- （enabled は JSON 側で『適用するか』を制御するだけ）。よってフラグは enabled に
-- 依存せず selectedGroupIds を反映すべき。enabled=false で保存していた選択が
-- 移行されず失われる不具合（次回保存で JSON の selectedGroupIds が [] へ strip される）を防ぐ。
--
-- 冪等: 既に true の行へ再度 true を立てるだけ。selectedGroupIds が JSON から
-- strip 済み（[] / 欠落）の試験は json_each が0行となり無変更。

UPDATE "ExamSubtotalGroup"
SET "selectedForTable" = 1
WHERE EXISTS (
  SELECT 1 FROM "ExamExportSettings" es,
    json_each(json_extract(es."settingsJson", '$.individualReportOptions.tableSubtotalGroupSelection.selectedGroupIds')) je
  WHERE es."examId" = "ExamSubtotalGroup"."examId"
    AND je.value = "ExamSubtotalGroup"."subtotalGroupId"
);

UPDATE "ExamSubtotalGroup"
SET "selectedForBoxPlot" = 1
WHERE EXISTS (
  SELECT 1 FROM "ExamExportSettings" es,
    json_each(json_extract(es."settingsJson", '$.individualReportOptions.boxPlotSubtotalGroupSelection.selectedGroupIds')) je
  WHERE es."examId" = "ExamSubtotalGroup"."examId"
    AND je.value = "ExamSubtotalGroup"."subtotalGroupId"
);
