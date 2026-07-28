import type {
  GetIndividualReportDataResult,
  IndividualReportOptions,
  SubtotalGroupsForReportResult,
} from "@/electron-src/lib/export/individual-report/types"
import type { ExportRDataOptions } from "@/electron-src/lib/export/r-exametrika/rDataExporter"
import type { PdfExportPageData } from "@/electron-src/lib/prisma/pdfExport"
import type {
  CaptureReturnSnapshotResult,
  ReturnDiffResult,
} from "@/electron-src/lib/prisma/returnSnapshot"
import type { StudentExportPlacement } from "@/electron-src/lib/shared/types"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ScoringValidationResult } from "@/types/exportValidation.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * エクスポート（PDF/Excel/印刷）関連API
 */
export interface ExportAPI {
  // Canvas描画エンジン用PDF出力API
  export: {
    // 採点データバリデーション（全エクスポート共通）
    validateScoringData: (options: {
      examId: string
      selectedExamStudentIds: string[]
      userId: string
    }) => Promise<
      | { success: false; error: string }
      | ({ success: true } & ScoringValidationResult)
    >

    /** 未解決の食い違いを含めて出力したことを監査ログに残す（出力は止めない） */
    recordUnresolvedConflicts: (options: {
      examId: string
      userId: string
      exportType: string
      conflicts: Array<{ studentName: string; questionLabel: string }>
      scoreImpact: number
    }) => Promise<{ success: boolean; error?: string }>

    // PDF出力に必要なデータを取得
    getPdfExportData: (options: {
      examId: string
      selectedExamStudentIds: string[]
    }) => Promise<{
      success: boolean
      examName?: string
      pages?: PdfExportPageData[]
      error?: string
    }>

    // Canvas描画済み画像からPDF作成
    createPdfFromRenderedImages: (options: {
      examId: string
      renderedPages: Array<{
        examStudentId: string
        pageNumber: number
        imageData: ArrayBuffer
      }>
      pdfOrientation?: "portrait" | "landscape"
      outputPath?: string
    }) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>

    // SVG→PNG変換（MathJaxテキストのtaint問題回避用）
    convertSvgToPng: (options: {
      svgString: string
      width?: number
      height?: number
    }) => Promise<{
      success: boolean
      dataUrl?: string
      width?: number // 描画時に使用すべき論理サイズ（Retinaでimg.widthは2倍になるため）
      height?: number
      error?: string
    }>

    // PDF保存先選択ダイアログ（Canvas描画前に呼び出す）
    selectPdfSavePath: (options: { examName?: string }) => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
    }>

    // ============================================================
    // ストリーミングPDF生成API
    // ============================================================

    // ストリーミングセッション作成（空ページを事前に作成）
    createPdfStreamingSession: (options: {
      totalPages: number
      pdfOrientation?: "portrait" | "landscape"
    }) => Promise<{
      success: boolean
      sessionId?: string
      error?: string
    }>

    // ストリーミングセッションにページを追加（Canvas描画完了次第呼び出し）
    addPageToStreamingSession: (options: {
      sessionId: string
      pageIndex: number
      imageData: ArrayBuffer
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // ストリーミングセッションを完了してPDF保存
    finalizeStreamingSession: (options: {
      sessionId: string
      outputPath: string
    }) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>

    // ストリーミングセッションをキャンセル
    cancelStreamingSession: (sessionId: string) => Promise<{
      success: boolean
      error?: string
    }>

    // ============================================================
    // 個人成績表PDF API
    // ============================================================

    // 個人成績表用データ取得
    getIndividualReportData: (options: {
      examId: string
      selectedExamStudentIds: string[]
      options: IndividualReportOptions
      studentPlacements?: Record<string, StudentExportPlacement>
    }) => Promise<GetIndividualReportDataResult>

    // 個人成績表用小計点グループ一覧取得
    getSubtotalGroupsForReport: (
      examId: string
    ) => Promise<SubtotalGroupsForReportResult>

    // 個人成績表PDF保存先選択ダイアログ
    selectIndividualReportSavePath: (options: {
      examName?: string
    }) => Promise<{
      success: boolean
      filePath?: string
      canceled?: boolean
    }>

    // 個人成績表PDFバッファを保存
    saveIndividualReportPdf: (options: {
      filePath: string
      pdfBuffer: ArrayBuffer
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // HTMLからPDFを生成（ブラウザ印刷機能を使用）
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
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // 複数のHTMLページからPDFを生成（バッチ処理）
    printMultipleHtmlToPdf: (options: {
      htmlPages: string[]
      filePath: string
      pageSize?: "A4" | "Letter"
      landscape?: boolean
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // Excelプレビューデータ取得
    getExcelPreviewData: (options: {
      examId: string
      selectedExamStudentIds: string[]
      studentPlacements?: Record<string, StudentExportPlacement>
    }) => Promise<{
      success: boolean
      questionRegions?: Array<{
        id: string
        label: string | null
        points: number | null
        orderIndex: number | null
      }>
      subtotalColumns?: Array<{
        subtotalId: string
        label: string
      }>
      scoringData?: Array<{
        examStudentId: string
        studentName: string
        studentNumber: string
        grade?: string
        className?: string
        attendanceNumber?: number | null
        status?: ExamStudentStatus
        scores: Array<{
          questionId: string
          questionLabel: string
          score: number | null
          maxScore: number
          status: ScoringStatus
        }>
        totalScore: number | null
        totalMaxScore: number
        subtotalScores: Array<{
          subtotalId: string
          subtotalLabel: string
          score: number | null
          maxScore: number
        }>
      }>
      error?: string
    }>

    // 印刷ダイアログを開く
    openPrintDialog: (options: {
      html: string
      title?: string
      pageSize?: "A4" | "Letter" | { width: number; height: number }
      landscape?: boolean
    }) => Promise<{
      success: boolean
      error?: string
    }>

    // 答案返却スナップショット: 現在の有効スコア＋注釈を返却版として記録
    captureReturnSnapshot: (options: {
      examId: string
      examStudentIds: string[]
    }) => Promise<CaptureReturnSnapshotResult>

    // 返却版と現在状態の差分（変更があった生徒の検出）
    getReturnDiff: (examId: string) => Promise<ReturnDiffResult>
  }

  // Excel Export related
  exportGradingDataExcel: (options: {
    examId: string
    selectedExamStudentIds: string[]
    outputPath?: string
    forceExport?: boolean
    studentPlacements?: Record<string, StudentExportPlacement>
  }) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
    warnings?: {
      noScoringData: string[]
      unscored: string[]
      missingPartialScore: string[]
      conflicted?: string[]
    }
    validationResult?: {
      hasWarnings: boolean
      warnings: {
        noScoringData: string[]
        unscored: string[]
        missingPartialScore: string[]
        conflicted?: string[]
      }
    }
  }>

  // R / exametrika 向けデータ出力（#834）
  exportRData: (options: ExportRDataOptions) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>

  // Progress listeners
  onExportProgress: (
    callback: (progress: {
      current: number
      total: number
      step: string
      percentage: number
      currentStepIndex?: number
      totalSteps?: number
    }) => void
  ) => () => void
}
