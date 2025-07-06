import type {
  DisabledState,
  UnifiedFile,
  UnifiedStudent,
} from "@/types/answer-sheet.types"

// 画像プレビュー用の型定義
export type PreviewMode = "full" | "name"

// table-dnd-kit-test準拠の拡張型定義
export interface ExtendedDisabledState extends DisabledState {
  cells: Set<string> // ファイルID単位の無効化
  files: Set<string> // ファイル答案無効化（コンテキストメニュー用）
}

// テーブルセルのデータ型定義（table-dnd-kit-test準拠）
export interface CellData {
  type: "disabled" | "file" | "empty"
  position: number
  file?: UnifiedFile
  student?: UnifiedStudent
  pageNumber?: number
}

// ファイルプレビューセルProps
export interface FilePreviewCellProps {
  file: UnifiedFile
  pageNumber: number
  previewMode: PreviewMode
  isFileDisabled: boolean
  nameRegionAvailable?: boolean
  getFileColor: (file: UnifiedFile) => string
  drawNameRegionCanvas: (
    file: UnifiedFile,
    pageNumber: number,
  ) => Promise<string | null>
  imageLoadState?: "pending" | "loading" | "loaded" | "error"
}

// ソート可能なテーブルセルProps
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

// 空のテーブルセルProps
export interface EmptyTableCellProps {
  position: number
  student?: UnifiedStudent
  pageNumber?: number
  isPositionDisabled: boolean
  onTogglePosition: () => void
  onUploadToCell: () => void
}