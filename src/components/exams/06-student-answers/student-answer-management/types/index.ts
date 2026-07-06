import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type { PendingChange } from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

// Processed student answer format for component compatibility
export interface ProcessedStudentAnswer {
  id: string
  studentId: string | null
  pageNumber: number
  originalImagePath: string | null
  isAbsent: boolean
  student: {
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentNumber: string
  } | null
  examId: string
  status: "ready"
}

// Local component-specific types
export interface StudentAnswerUploadProps {
  examId: string
  students: ExamStudentWithMemberships[]
  modelAnswerCount: number
  onUploadComplete?: () => void
  existingStudentAnswers?: ProcessedStudentAnswer[]
  mode?: "upload" | "view"

  // 変更状態管理用（確認モードのみ）
  pendingChanges?: PendingChange[]
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
