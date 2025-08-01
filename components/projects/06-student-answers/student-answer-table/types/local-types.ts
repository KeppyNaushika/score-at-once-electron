import type {
  PendingChange,
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
} from "@/types/student-answer.types"

// ============================================================================
// StudentAnswerTable専用の型定義
// ============================================================================

export interface UploadModalState {
  isOpen: boolean
  position?: number
  studentName?: string
  pageNumber?: number
}

export interface StudentAnswerTableProps {
  projectId: string
  students: UnifiedStudent[]
  files: UnifiedFile[]
  modelAnswerCount: number
  fileOrder?: PlacementStrategy
  isUploading?: boolean
  onFileOrderChange?: (order: PlacementStrategy) => void
  onFilesChange: (files: UnifiedFile[]) => void
  onUpload: (data: UploadData[]) => void
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  observerRef?: React.RefObject<IntersectionObserver | null>
  mode?: "upload" | "view"
  onReloadData?: () => void

  // 変更状態管理用（確認モードのみ）
  pendingChanges?: PendingChange[]
  affectedCells?: Set<string>
  onUpdatePendingChanges?: (
    changedFiles: Array<{ fileId: string; fromState: any; toState: any }>,
  ) => void

  // 上書き制御用（アップロードモードでの既存答案情報）
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
}

export type DisabledReason =
  | "row"
  | "column"
  | "position"
  | "existing_answer"
  | "absent_student"
  | undefined
