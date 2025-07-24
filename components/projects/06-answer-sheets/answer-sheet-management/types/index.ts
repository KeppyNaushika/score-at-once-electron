// Import and re-export from answer-sheet.types for consistency
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
  PendingChange,
} from "@/types/answer-sheet.types"

export type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
  PendingChange,
}

// Local component-specific types
export interface AnswerSheetUploadProps {
  projectId: string
  students: UnifiedStudent[]
  masterImageCount: number
  onUploadComplete?: () => void
  existingAnswerSheets?: Array<{
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
      studentId: string
    } | null
  }>
  mode?: "upload" | "view"
  
  // 変更状態管理用（確認モードのみ）
  pendingChanges?: PendingChange[]
  affectedCells?: Set<string>
  onUpdatePendingChanges?: (changedFiles: Array<{ fileId: string; fromState: any; toState: any }>) => void
  onResetDragDrop?: React.MutableRefObject<(() => void) | null>
}

export interface FileUploadZoneProps {
  onDrop: (files: File[]) => void
  isConverting: boolean
  disabled?: boolean
  masterImageCount: number
  pdfProcessingProgress: number
}

export interface GridHeaderProps {
  maxPages: number
  pageStates: Set<number>
  onTogglePage: (pageNumber: number) => void
}

export interface StudentCellProps {
  student: UnifiedStudent
  isEnabled: boolean
  onToggle: () => void
}

export interface AnswerCellProps {
  student: UnifiedStudent | null
  pageNumber: number
  file: UnifiedFile | null
  isStudentDisabled: boolean
  isPageDisabled: boolean
  isCellDisabled: boolean
  isFileDisabled: boolean
  onToggleCell: () => void
  onToggleFile?: () => void
  onRemoveFile?: () => void
  onCellClick?: () => void
  className?: string
}

export interface StudentGridRowProps {
  student: UnifiedStudent
  maxPages: number
  pageStates: Set<number>
  cellStates: Set<string>
  fileStates: Set<string>
  files: UnifiedFile[]
  isStudentDisabled: boolean
  onToggleStudent: () => void
  onToggleCell: (studentId: string, pageNumber: number) => void
  onToggleFile: (fileId: string) => void
  onRemoveFile: (fileId: string) => void
  onCellClick: (studentId: string, pageNumber: number) => void
}