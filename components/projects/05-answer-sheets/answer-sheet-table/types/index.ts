import type { UnifiedFile, UnifiedStudent } from "@/types/answer-sheet.types"

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
  student: UnifiedStudent | null
  pageNumber: number | null
  file?: UnifiedFile
}

// Component props interfaces
export interface FilePreviewCellProps {
  file: UnifiedFile
  pageNumber: number
  previewMode: PreviewMode
  isFileDisabled: boolean
  nameRegionAvailable: boolean
  getFileColor: (file: UnifiedFile) => string
  drawNameRegionCanvas: (file: UnifiedFile, pageNumber: number) => Promise<string | null>
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
  fileId?: string
  observerRef?: React.RefObject<IntersectionObserver | null>
  children: React.ReactNode
}

export interface EmptyTableCellProps {
  position: number
  student: UnifiedStudent | null
  pageNumber: number | null
  isPositionDisabled: boolean
  onTogglePosition: () => void
  onUploadToCell: () => void
}

export interface TableHeaderProps {
  maxPages: number
  enabledFilesCount: number
  trashFiles: UnifiedFile[]
  onFileRestore: (fileId: string) => void
  isUploading: boolean
  mode: "upload" | "view"
  onUpload: () => void
  fileOrder: "page-first" | "student-first"
  onFileOrderChange?: (order: "page-first" | "student-first") => void
  previewMode: PreviewMode
  onPreviewModeChange: (mode: PreviewMode) => void
  hasNameRegion: boolean
}

export interface PlacementStrategySelectorProps {
  fileOrder: "page-first" | "student-first"
  onFileOrderChange?: (order: "page-first" | "student-first") => void
}

export interface PreviewModeToggleProps {
  previewMode: PreviewMode
  onPreviewModeChange: (mode: PreviewMode) => void
  hasNameRegion: boolean
}