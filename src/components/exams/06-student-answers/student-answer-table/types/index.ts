import type {
  AnswerImageIdentity,
  ExamPageColumn,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

// Preview mode for different display options
export type PreviewMode = "full" | "name-only"

// セル同一性 = (studentId, examPageId)。序数 pageNumber は key にしない。
export interface DisabledCell {
  studentId: string
  examPageId: string
}

// Extended disabled state for table management.
// index やフラット position ではなく、安定した id でキーする
// （並べ替え・フィルタ・生徒追加でズレないため）。Set は使わず配列で持つ。
export interface ExtendedDisabledState {
  rows: string[] // examStudentId（ExamStudent.id）— 無効行は少数なので配列
  cols: string[] // examPageId（ExamPage.id）— 無効列は少数なので配列
  cells: DisabledCell[] // (studentId, examPageId) — 個別無効セルは少数なので配列
  files: Set<string> // fileId — アップロードで多数になりうるので Set（O(1)）
}

// Cell data structure for table rendering.
// セルは「そのマスに置かれた物（file）と無効理由」だけを持つ。
// 生徒・ページ・position はグリッド座標 [studentIndex][pageIndex] と
// sortedStudents / examPages から導出する（セルにエンティティを複製させない）。
// upload は file が UnsavedAnswerImage、view は PlacedAnswerImage。
export interface CellData<
  TItem extends AnswerImageIdentity = AnswerImageIdentity,
> {
  type: "file" | "empty" | "disabled"
  file?: TItem
  disabledReason?:
    "row" | "column" | "position" | "existing_answer" | "absent_student"
}

/**
 * FilePreviewCell の表示ソース（呼び出し側がエンティティ／未保存項目から fileId 別に導出）。
 * 表・DnD が持ち回る同定（AnswerImageIdentity）とは分離し、表示専用の派生値をここに集約する。
 */
export interface FilePreviewSource {
  previewUrl?: string // 未保存 blob（メモリ内）
  imagePath?: string | null // DB答案の遅延読込パス
  altName: string
  correctionStatus?: "corrected" | "skipped" | "not_requested"
  correctionError?: string
}

// ファイルプレビューセルの props（表示値は呼び出し側がエンティティ／未保存項目から導出）。
export interface FilePreviewCellProps {
  previewUrl?: string // 未保存 blob or 読込済みキャッシュ（同期初期値）
  imagePath?: string | null // DB答案の遅延読込パス
  altName: string // alt・dev 表示用
  pageNumber: number // 表示・氏名欄クリップ対象ページ（列 ExamPage から導出）
  previewMode: PreviewMode
  isFileDisabled: boolean
  nameRegionAvailable: boolean
  drawNameRegionCanvas: (
    previewUrl: string | null,
    pageNumber: number
  ) => Promise<string | null>
  imageLoadState?: "pending" | "loading" | "loaded" | "error"
  correctionStatus?: "corrected" | "skipped" | "not_requested"
  correctionError?: string
  isPendingChange?: boolean
  hasExistingAnswer?: boolean
  allowOverwrite?: boolean
  isCorrecting?: boolean
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
  examPage: ExamPageColumn | null // droppable の examPageId・表示 pageNumber
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
  // ゴミ箱は upload 専用（無効化した UnsavedAnswerImage）。表示に必要な最小形だけを受ける。
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
