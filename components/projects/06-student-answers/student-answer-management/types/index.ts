// Import and re-export from student-answer.types for consistency
import type {
  PendingChange,
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
} from "@/types/student-answer.types"

export type {
  PendingChange,
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
  UploadData,
}

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
    studentId: string
  } | null
  projectId: string
  status: "ready"
}

// Local component-specific types
export interface StudentAnswerUploadProps {
  projectId: string
  students: UnifiedStudent[]
  modelAnswerCount: number
  onUploadComplete?: () => void
  existingStudentAnswers?: ProcessedStudentAnswer[]
  mode?: "upload" | "view"

  // 変更状態管理用（確認モードのみ）
  pendingChanges?: PendingChange[]
  affectedCells?: Set<string>
  onUpdatePendingChanges?: (
    changedFiles: Array<{ fileId: string; fromState: any; toState: any }>,
  ) => void
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
  isFileDisabled: boolean
  onToggleFile?: () => void
  onRemoveFile?: () => void
  onCellClick?: () => void
  className?: string
}

export interface StudentGridRowProps {
  student: UnifiedStudent
  maxPages: number
  pageStates: Set<number>
  fileStates: Set<string>
  files: UnifiedFile[]
  isStudentDisabled: boolean
  onToggleStudent: () => void
  onToggleFile: (fileId: string) => void
  onRemoveFile: (fileId: string) => void
  onCellClick: (studentId: string, pageNumber: number) => void
}
