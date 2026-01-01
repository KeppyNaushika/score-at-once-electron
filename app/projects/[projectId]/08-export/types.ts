// 個人成績表用型定義をre-export
export {
  DEFAULT_ADVICE_OPTIONS,
  DEFAULT_GRAPH_OPTIONS,
  DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
} from "@/electron-src/lib/export/individual-report/types"
export type {
  AdviceOptions,
  AverageDisplayType,
  FontSizeOption,
  GraphOptions,
  IndividualReportOptions,
  QuestionTableColumns,
  RankDisplayType,
  ReportDisplayMode,
  ScoreRateFormat,
  SubtotalTableColumns,
} from "@/electron-src/lib/export/individual-report/types"

// 生徒の状態を表す型
export type StudentStatus = "participating" | "expected" | "absent"

// 生徒データの型
export interface Student {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: {
    id: string
    attendanceNumber?: number | null
    class: {
      id: string
      name: string
    }
  }[]
  status: StudentStatus
  isInProject: boolean
  customOrder?: number | null
}

// PDF用紙の向きの型
export type PdfOrientation = "portrait" | "landscape"

// 出力オプションの型
export interface ExportOptions {
  includeScoredAnswers: boolean
  includeIndividualReports: boolean
  includeGradingData: boolean
  format: "pdf" | "excel"
  markPosition: string
  markSize: number
  showMarks: boolean
  pdfOrientation: PdfOrientation
  parallelCount: number // 並列処理数（1-8）
}

// PDF出力フェーズの型
export type ExportPhase =
  | "initializing"
  | "rendering"
  | "embedding"
  | "saving"
  | "complete"

// Canvas描画の詳細プログレス
export interface RenderProgress {
  phase: "preload" | "rendering" | "complete"
  total: number
  completed: number
  inProgress: number // 現在描画中のページ数
  currentPages: number[] // 描画中のページインデックス
}

// PDF埋め込みの詳細プログレス
export interface EmbedProgress {
  total: number
  completed: number
}

// 詳細なプログレス状態
export interface DetailedProgressState {
  overallPercentage: number
  phase: ExportPhase

  // Canvas描画の詳細
  rendering: RenderProgress

  // PDF埋め込みの詳細
  embedding: EmbedProgress

  // タイミング情報
  timing: {
    startTime: number
    estimatedRemaining: number | null // 秒
  }
}

// レンダリングされたページデータ
export interface RenderedPageData {
  pageIndex: number
  studentId: string
  pageNumber: number
  imageData: ArrayBuffer
}
