import type {
  PendingChange,
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
} from "@/types/answer-sheet.types"

// ============================================================================
// AnswerSheetTable専用の型定義
// ============================================================================

export interface UploadModalState {
  isOpen: boolean
  position?: number
  studentName?: string
  pageNumber?: number
}

export interface AnswerSheetTableProps {
  projectId: string
  students: UnifiedStudent[]
  files: UnifiedFile[]
  masterImageCount: number
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
  onResetDragDrop?: React.MutableRefObject<(() => void) | null>

  // 上書き制御用（アップロードモードでの既存答案情報）
  existingAnswerSheets?: Array<{
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