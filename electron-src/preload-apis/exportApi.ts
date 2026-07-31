import { ipcRenderer } from "electron"

import type { IndividualReportOptions } from "../lib/export/individual-report/types"
import type { ExportRDataOptions } from "../lib/export/r-exametrika/rDataExporter"
import type { StudentExportPlacement } from "../lib/shared/types"

/** 出力機能のIPC API（PDF/Excel出力・ストリーミング生成・個人成績表・印刷） */
export function createExportApi() {
  return {
    // Canvas描画エンジン用PDF出力API
    export: {
      validateScoringData: (options: {
        examId: string
        selectedExamStudentIds: string[]
        userId: string
      }) => ipcRenderer.invoke("export:validateScoringData", options),
      recordUnresolvedConflicts: (options: {
        examId: string
        userId: string
        exportType: string
        conflicts: Array<{ studentName: string; questionLabel: string }>
        scoreImpact: number
      }) => ipcRenderer.invoke("export:recordUnresolvedConflicts", options),
      getPdfExportData: (options: {
        examId: string
        selectedExamStudentIds: string[]
      }) => ipcRenderer.invoke("export:getPdfExportData", options),
      createPdfFromRenderedImages: (options: {
        examId: string
        renderedPages: Array<{
          examStudentId: string
          pageNumber: number
          imageData: ArrayBuffer
        }>
        pdfOrientation?: "portrait" | "landscape"
        outputPath?: string
      }) => ipcRenderer.invoke("export:createPdfFromRenderedImages", options),
      convertSvgToPng: (options: {
        svgString: string
        width?: number
        height?: number
      }) => ipcRenderer.invoke("export:convertSvgToPng", options),
      selectPdfSavePath: (options: { examName?: string }) =>
        ipcRenderer.invoke("export:selectPdfSavePath", options),
      // ストリーミングPDF生成API
      createPdfStreamingSession: (options: {
        totalPages: number
        pdfOrientation?: "portrait" | "landscape"
      }) => ipcRenderer.invoke("export:createPdfStreamingSession", options),
      addPageToStreamingSession: (options: {
        sessionId: string
        pageIndex: number
        imageData: ArrayBuffer
      }) => ipcRenderer.invoke("export:addPageToStreamingSession", options),
      finalizeStreamingSession: (options: {
        sessionId: string
        outputPath: string
      }) => ipcRenderer.invoke("export:finalizeStreamingSession", options),
      cancelStreamingSession: (sessionId: string) =>
        ipcRenderer.invoke("export:cancelStreamingSession", sessionId),
      // 個人成績表PDF API
      getIndividualReportData: (options: {
        examId: string
        selectedExamStudentIds: string[]
        options: IndividualReportOptions
        studentPlacements?: Record<string, StudentExportPlacement>
      }) => ipcRenderer.invoke("export:getIndividualReportData", options),
      getSubtotalGroupsForReport: (examId: string) =>
        ipcRenderer.invoke("export:getSubtotalGroupsForReport", examId),
      selectIndividualReportSavePath: (options: { examName?: string }) =>
        ipcRenderer.invoke("export:selectIndividualReportSavePath", options),
      saveIndividualReportPdf: (options: {
        filePath: string
        pdfBuffer: ArrayBuffer
      }) => ipcRenderer.invoke("export:saveIndividualReportPdf", options),
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
      }) => ipcRenderer.invoke("export:printHtmlToPdf", options),
      printMultipleHtmlToPdf: (options: {
        htmlPages: string[]
        filePath: string
        pageSize?: "A4" | "Letter"
        landscape?: boolean
      }) => ipcRenderer.invoke("export:printMultipleHtmlToPdf", options),
      // Excelプレビューデータ取得
      getExcelPreviewData: (options: {
        examId: string
        selectedExamStudentIds: string[]
        studentPlacements?: Record<string, StudentExportPlacement>
      }) => ipcRenderer.invoke("export:getExcelPreviewData", options),
      // 印刷ダイアログを開く
      openPrintDialog: (options: {
        html: string
        title?: string
        pageSize?: "A4" | "Letter" | { width: number; height: number }
        landscape?: boolean
      }) => ipcRenderer.invoke("export:openPrintDialog", options),
      // 答案返却スナップショット: 現在の有効スコア＋注釈を返却版として記録
      captureReturnSnapshot: (options: {
        examId: string
        examStudentIds: string[]
      }) => ipcRenderer.invoke("export:captureReturnSnapshot", options),
      // 返却版と現在状態の差分（変更があった生徒の検出）
      getReturnDiff: (examId: string) =>
        ipcRenderer.invoke("export:getReturnDiff", examId),
    },

    // Excel Export related
    exportGradingDataExcel: (options: {
      examId: string
      selectedExamStudentIds: string[]
      outputPath?: string
      studentPlacements?: Record<string, StudentExportPlacement>
    }) => ipcRenderer.invoke("export-grading-data-excel", options),

    // R / exametrika 向けデータ出力（#834）
    exportRData: (options: ExportRDataOptions) =>
      ipcRenderer.invoke("export-r-data", options),

    // Progress listeners
    onExportProgress: (
      callback: (progress: {
        current: number
        total: number
        step: string
        percentage: number
      }) => void
    ) => {
      ipcRenderer.on("export-progress", (_event, progress) =>
        callback(progress)
      )
      return () => ipcRenderer.removeAllListeners("export-progress")
    },
  }
}
