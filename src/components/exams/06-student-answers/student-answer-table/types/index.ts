import type {
  AnswerItem,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

// Preview mode for different display options
export type PreviewMode = "full" | "name-only"

// セル同一性 = (studentId, pageNumber)。Set の合成文字列キーをやめ、
// 型付きレコードで持つ（DnD の FileState と同じ identity 照合の流儀）。
export interface DisabledCell {
  studentId: string
  pageNumber: number
}

// Extended disabled state for table management.
// index やフラット position ではなく、安定した同一性でキーする
// （並べ替え・フィルタ・生徒追加でズレないため）。Set は使わず配列で持つ。
export interface ExtendedDisabledState {
  rows: string[] // examStudentId（ExamStudent.id）— 無効行は少数なので配列
  cols: number[] // pageNumber（1始まりの序数）— 無効列は少数なので配列
  cells: DisabledCell[] // (studentId, pageNumber) — 個別無効セルは少数なので配列
  files: Set<string> // fileId — アップロードで多数になりうるので Set（O(1)）
}

// Cell data structure for table rendering.
// セルは「そのマスに置かれた物（file）と無効理由」だけを持つ。
// 生徒・ページ・position はグリッド座標 [studentIndex][pageIndex] と
// sortedStudents から投射する（セルにエンティティを複製させない）。
// upload は file が PendingImage、view は AnswerItem。既定は共通描画ビュー AnswerItem。
export interface CellData<TItem extends AnswerItem = AnswerItem> {
  type: "file" | "empty" | "disabled"
  file?: TItem
  disabledReason?:
    "row" | "column" | "position" | "existing_answer" | "absent_student"
}

// Component props interfaces
export interface FilePreviewCellProps {
  file: AnswerItem
  pageNumber: number
  previewMode: PreviewMode
  isFileDisabled: boolean
  nameRegionAvailable: boolean
  getFileColor: (file: AnswerItem) => string
  drawNameRegionCanvas: (
    file: AnswerItem,
    pageNumber: number
  ) => Promise<string | null>
  imageLoadState?: "pending" | "loading" | "loaded" | "error"
}

// アップロード（方式A）専用の並べ替えセル props。
export interface SortableTableCellProps {
  id: string
  hasFile: boolean
  isPositionDisabled: boolean
  isFileDisabled: boolean
  onTogglePosition: () => void
  onToggleFileDisabled: () => void
  fileId?: string
  children: React.ReactNode
}

export interface EmptyTableCellProps {
  examStudent: ExamStudentWithMemberships | null
  pageNumber: number | null
  isPositionDisabled: boolean
  isPendingChange?: boolean
  mode?: "upload" | "view"
  hasExistingAnswer?: boolean
  allowOverwrite?: boolean
  disabledReason?:
    "row" | "column" | "position" | "existing_answer" | "absent_student"
  onTogglePosition?: () => void
  onToggleAnswerDisabled?: () => void
  hasNewFileToUpload?: boolean
}

export interface TableHeaderProps {
  maxPages: number
  enabledFilesCount: number
  // ゴミ箱は upload 専用（無効化した PendingImage）。表示に必要な最小形だけを受ける。
  trashFiles: Array<{ id: string; name: string; size?: number }>
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
  markerCorrectionEnabled?: boolean
  markerCorrectionAvailable?: boolean
  markerDiagnostics?: string
  onMarkerCorrectionChange?: (enabled: boolean) => void
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
