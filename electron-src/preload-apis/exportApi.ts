import { bind } from "./invoke"

/** 出力機能のIPC API（PDF/Excel出力・ストリーミング生成・個人成績表・印刷） */
export function createExportApi() {
  return {
    // Canvas描画エンジン用PDF出力API
    export: {
      validateScoringData: bind("export:validateScoringData"),
      recordUnresolvedConflicts: bind("export:recordUnresolvedConflicts"),
      getPdfExportData: bind("export:getPdfExportData"),
      convertSvgToPng: bind("export:convertSvgToPng"),
      selectPdfSavePath: bind("export:selectPdfSavePath"),
      // ストリーミングPDF生成API
      createPdfStreamingSession: bind("export:createPdfStreamingSession"),
      addPageToStreamingSession: bind("export:addPageToStreamingSession"),
      finalizeStreamingSession: bind("export:finalizeStreamingSession"),
      cancelStreamingSession: bind("export:cancelStreamingSession"),
      // 個人成績表PDF API
      getIndividualReportData: bind("export:getIndividualReportData"),
      getSubtotalGroupsForReport: bind("export:getSubtotalGroupsForReport"),
      // HTML to PDF (ブラウザ印刷機能)
      printHtmlToPdf: bind("export:printHtmlToPdf"),
      // Excelプレビューデータ取得
      getExcelPreviewData: bind("export:getExcelPreviewData"),
      // 印刷ダイアログを開く
      openPrintDialog: bind("export:openPrintDialog"),
      // 答案返却スナップショット: 現在の有効スコア＋注釈を返却版として記録
      captureReturnSnapshot: bind("export:captureReturnSnapshot"),
      // 返却版と現在状態の差分（変更があった生徒の検出）
      getReturnDiff: bind("export:getReturnDiff"),
    },

    // Excel Export related
    exportGradingDataExcel: bind("export-grading-data-excel"),

    // R / exametrika 向けデータ出力（#834）
    exportRData: bind("export-r-data"),
  }
}
