import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

// 生徒データの型 = getStudentsForExam の戻り値（ExamStudentWithMemberships）。
// 08結果出力では学級情報は classroomInfoMap 経由で解決し、受験生徒の識別・所属・
// 受験状態・並び順のみを examStudent.student(.memberships) / status / customOrder で参照する。
export type Student = ExamStudentWithMemberships

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
  "initializing" | "rendering" | "embedding" | "saving" | "complete"

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
