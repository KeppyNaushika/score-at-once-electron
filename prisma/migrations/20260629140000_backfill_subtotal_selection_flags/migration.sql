-- 小計グループ選択を settingsJson から ExamSubtotalGroup フラグへ移行（P5: 亡霊ID排除）
-- 旧: ExamExportSettings.settingsJson.individualReportOptions.{table,boxPlot}SubtotalGroupSelection.selectedGroupIds
-- 新: ExamSubtotalGroup.selectedForTable / selectedForBoxPlot
-- enabled=true の選択のみ移行（enabled=false は「全グループ表示」なのでフラグを立てない）

UPDATE "ExamSubtotalGroup"
SET "selectedForTable" = 1
WHERE EXISTS (
  SELECT 1 FROM "ExamExportSettings" es,
    json_each(json_extract(es."settingsJson", '$.individualReportOptions.tableSubtotalGroupSelection.selectedGroupIds')) je
  WHERE es."examId" = "ExamSubtotalGroup"."examId"
    AND json_extract(es."settingsJson", '$.individualReportOptions.tableSubtotalGroupSelection.enabled') = 1
    AND je.value = "ExamSubtotalGroup"."subtotalGroupId"
);

UPDATE "ExamSubtotalGroup"
SET "selectedForBoxPlot" = 1
WHERE EXISTS (
  SELECT 1 FROM "ExamExportSettings" es,
    json_each(json_extract(es."settingsJson", '$.individualReportOptions.boxPlotSubtotalGroupSelection.selectedGroupIds')) je
  WHERE es."examId" = "ExamSubtotalGroup"."examId"
    AND json_extract(es."settingsJson", '$.individualReportOptions.boxPlotSubtotalGroupSelection.enabled') = 1
    AND je.value = "ExamSubtotalGroup"."subtotalGroupId"
);
