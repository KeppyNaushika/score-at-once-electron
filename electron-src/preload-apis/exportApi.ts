import type { IndividualReportOptions } from "../lib/export/individual-report/types"
import type { ExportRDataOptions } from "../lib/export/r-exametrika/rDataExporter"
import type { StudentExportPlacement } from "../lib/shared/types"
import { invoke } from "./invoke"

/** 出力機能のIPC API（PDF/Excel出力・ストリーミング生成・個人成績表・印刷） */
export function createExportApi() {
  return {
    // Canvas描画エンジン用PDF出力API
    export: {
      validateScoringData: (options: {
        examId: string
        selectedExamStudentIds: string[]
        userId: string
      }) => invoke("export:validateScoringData", options),
      recordUnresolvedConflicts: (options: {
        examId: string
        userId: string
        exportType: string
        conflicts: Array<{ studentName: string; questionLabel: string }>
        scoreImpact: number
      }) => invoke("export:recordUnresolvedConflicts", options),
      getPdfExportData: (options: {
        examId: string
        selectedExamStudentIds: string[]
      }) => invoke("export:getPdfExportData", options),
      convertSvgToPng: (options: {
        svgString: string
        width?: number
        height?: number
      }) => invoke("export:convertSvgToPng", options),
      selectPdfSavePath: (options: { examName?: string }) =>
        invoke("export:selectPdfSavePath", options),
      // ストリーミングPDF生成API
      createPdfStreamingSession: (options: {
        totalPages: number
        pdfOrientation?: "portrait" | "landscape"
      }) => invoke("export:createPdfStreamingSession", options),
      addPageToStreamingSession: (options: {
        sessionId: string
        pageIndex: number
        imageData: ArrayBuffer
      }) => invoke("export:addPageToStreamingSession", options),
      finalizeStreamingSession: (options: {
        sessionId: string
        outputPath: string
      }) => invoke("export:finalizeStreamingSession", options),
      cancelStreamingSession: (sessionId: string) =>
        invoke("export:cancelStreamingSession", sessionId),
      // 個人成績表PDF API
      getIndividualReportData: (options: {
        examId: string
        selectedExamStudentIds: string[]
        options: IndividualReportOptions
        studentPlacements?: Record<string, StudentExportPlacement>
      }) => invoke("export:getIndividualReportData", options),
      getSubtotalGroupsForReport: (examId: string) =>
        invoke("export:getSubtotalGroupsForReport", examId),
      // HTML to PDF (ブラウザ印刷機能)
      printHtmlToPdf: (options: {
        html: string
        filePath: string
        pageSize?: "A4" | "Letter" | { width: number; height: number }
        landscape?: boolean
        margins?: {
          top?: number
          bottom?: number
          left?: number
          right?: number
        }
      }) => invoke("export:printHtmlToPdf", options),
      // Excelプレビューデータ取得
      getExcelPreviewData: (options: {
        examId: string
        selectedExamStudentIds: string[]
        studentPlacements?: Record<string, StudentExportPlacement>
      }) => invoke("export:getExcelPreviewData", options),
      // 印刷ダイアログを開く
      openPrintDialog: (options: {
        html: string
        title?: string
        pageSize?: "A4" | "Letter" | { width: number; height: number }
        landscape?: boolean
      }) => invoke("export:openPrintDialog", options),
      // 答案返却スナップショット: 現在の有効スコア＋注釈を返却版として記録
      captureReturnSnapshot: (options: {
        examId: string
        examStudentIds: string[]
      }) => invoke("export:captureReturnSnapshot", options),
      // 返却版と現在状態の差分（変更があった生徒の検出）
      getReturnDiff: (examId: string) => invoke("export:getReturnDiff", examId),
    },

    // Excel Export related
    exportGradingDataExcel: (options: {
      examId: string
      selectedExamStudentIds: string[]
      outputPath?: string
      studentPlacements?: Record<string, StudentExportPlacement>
    }) => invoke("export-grading-data-excel", options),

    // R / exametrika 向けデータ出力（#834）
    exportRData: (options: ExportRDataOptions) =>
      invoke("export-r-data", options),
  }
}
