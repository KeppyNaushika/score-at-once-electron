import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/types/answer-sheet.types"

// Preview mode for different display options
export type PreviewMode = "full" | "name-only"

// Extended disabled state for table management
export interface ExtendedDisabledState {
  rows: Set<number>
  cols: Set<number>
  positions: Set<number>
  files: Set<string>
}

// Cell data structure for table rendering
export interface CellData {
  type: "file" | "empty" | "disabled"
  position: number
  student?: UnifiedStudent
  pageNumber?: number
  file?: UnifiedFile
  disabledReason?: "row" | "column" | "position" | "existing_answer" | "absent_student"
}

// Component props interfaces
export interface FilePreviewCellProps {
  file: UnifiedFile
  pageNumber: number
  previewMode: PreviewMode
  isFileDisabled: boolean
  nameRegionAvailable: boolean
  getFileColor: (file: UnifiedFile) => string
  drawNameRegionCanvas: (
    file: UnifiedFile,
    pageNumber: number,
  ) => Promise<string | null>
  imageLoadState?: "pending" | "loading" | "loaded" | "error"
}

export interface SortableTableCellProps {
  id: string
  position: number
  hasFile: boolean
  isPositionDisabled: boolean
  isFileDisabled: boolean
  onTogglePosition: () => void
  onToggleFileDisabled: () => void
  onUploadToCell: () => void
  mode?: "upload" | "view"
  fileId?: string
  observerRef?: React.RefObject<IntersectionObserver | null>
  children: React.ReactNode
  onDeleteFileWithScoring?: () => void
  studentName?: string
  pageNumber?: number
  hasScoreData?: boolean
}

export interface EmptyTableCellProps {
  position: number
  student: UnifiedStudent | null
  pageNumber: number | null
  isPositionDisabled: boolean
  isPendingChange?: boolean
  mode?: "upload" | "view"
  hasExistingAnswer?: boolean
  allowOverwrite?: boolean
  disabledReason?:
    | "row"
    | "column"
    | "position"
    | "existing_answer"
    | "absent_student"
  onTogglePosition?: () => void
  onUploadToCell?: () => void
  onToggleAnswerDisabled?: () => void
  hasNewFileToUpload?: boolean
}

export interface TableHeaderProps {
  maxPages: number
  enabledFilesCount: number
  trashFiles: UnifiedFile[]
  onFileRestore: (fileId: string) => void
  isUploading: boolean
  mode: "upload" | "view"
  onUpload: () => void
  fileOrder: PlacementStrategy
  onFileOrderChange?: (order: PlacementStrategy) => void
  previewMode: PreviewMode
  onPreviewModeChange: (mode: PreviewMode) => void
  hasNameRegion: boolean
  allowOverwrite?: boolean
  onAllowOverwriteChange?: (allow: boolean) => void
}

export interface PlacementStrategySelectorProps {
  fileOrder: PlacementStrategy
  onFileOrderChange?: (order: PlacementStrategy) => void
}

export interface PreviewModeToggleProps {
  previewMode: PreviewMode
  onPreviewModeChange: (mode: PreviewMode) => void
  hasNameRegion: boolean
}
