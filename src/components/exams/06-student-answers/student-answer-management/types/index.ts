import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type {
  ExamStudentWithMemberships,
  StudentAnswerDatasetExamPage,
} from "@/types/prismaExtensions"

// Local component-specific types
export interface StudentAnswerUploadProps {
  examId: string
  students: ExamStudentWithMemberships[]
  // 列＝ExamPage 実体（配置済み答案を子に持つ）。Prisma include のまま持ち回る。
  examPages: StudentAnswerDatasetExamPage[]
  onUploadComplete?: () => void
  mode?: "upload" | "view"

  // 変更状態管理用（確認モードのみ）
  affectedCells?: Set<string>
  onUpdatePendingChanges?: (
    changedFiles: Array<{
      fileId: string
      fromState: FileState
      toState: FileState
    }>
  ) => void

  // ナビゲーションガード用: アップロード待ちファイル数の通知
  onUploadFileCountChange?: (count: number) => void

  // マーカー補正ステータス
  correctionStatusMap?: Map<string, "corrected" | "skipped">
  onCorrectionStatusUpdate?: (map: Map<string, "corrected" | "skipped">) => void
}

export interface FileUploadZoneProps {
  onDrop: (files: File[]) => void
  isConverting: boolean
  disabled?: boolean
  modelAnswerCount: number
  pdfProcessingProgress: number
}

export interface GridHeaderProps {
  maxPages: number
  pageStates: Set<number>
  onTogglePage: (pageNumber: number) => void
}
