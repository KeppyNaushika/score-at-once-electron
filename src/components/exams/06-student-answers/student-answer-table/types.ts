import type {
  DragEndEvent,
  DragStartEvent,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core"

import type {
  AnswerImageIdentity,
  ExamPageColumn,
  PlacementStrategy,
  UnsavedAnswerImage,
  UploadData,
} from "@/components/exams/06-student-answers/types"
import type {
  PlacedAnswerImage,
  StudentAnswerDatasetExamStudent,
} from "@/types/prismaExtensions"

// Preview mode for different display options
export type PreviewMode = "full" | "name-only"

// セル同一性 = (examStudentId, examPageId)。序数 pageNumber は key にしない。
export interface DisabledCell {
  examStudentId: string
  examPageId: string
}

// Extended disabled state for table management.
// index やフラット position ではなく、安定した id でキーする
// （並べ替え・フィルタ・生徒追加でズレないため）。Set は使わず配列で持つ。
export interface ExtendedDisabledState {
  rows: string[] // examStudentId（ExamStudent.id）— 無効行は少数なので配列
  cols: string[] // examPageId（ExamPage.id）— 無効列は少数なので配列
  cells: DisabledCell[] // (examStudentId, examPageId) — 個別無効セルは少数なので配列
  files: Set<string> // fileId — アップロードで多数になりうるので Set（O(1)）
}

// 表の1マス。列の実体（ExamPage）を同梱し、そのマスに置かれた物（file）と無効理由を持つ。
// 行（AnswerTableRow）が生徒の実体を持つため、「行・列とマスの対応」は添字の一致という
// 暗黙の約束ではなく構造で保証される（序数を同定に使わない）。
// upload は file が UnsavedAnswerImage、view は PlacedAnswerImage。
export interface AnswerTableCell<
  TItem extends AnswerImageIdentity = AnswerImageIdentity,
> {
  examPage: ExamPageColumn
  type: "file" | "empty" | "disabled"
  file?: TItem
  disabledReason?: DisabledReason
}

// 表の1行。行の実体（ExamStudent）と、その行のマスを列順（examPages の順）に持つ。
export interface AnswerTableRow<
  TItem extends AnswerImageIdentity = AnswerImageIdentity,
> {
  examStudent: StudentAnswerDatasetExamStudent
  cells: AnswerTableCell<TItem>[]
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
  examPageId: string | null // 氏名欄クリップ対象ページ（列 ExamPage の id。孤立答案は null）
  previewMode: PreviewMode
  isFileDisabled: boolean
  nameRegionAvailable: boolean
  drawNameRegionCanvas: (
    previewUrl: string | null,
    examPageId: string | null
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
  examStudent: StudentAnswerDatasetExamStudent | null
  examPage: ExamPageColumn | null // droppable の examPageId・表示 pageNumber
  isPositionDisabled: boolean
  isPendingChange?: boolean
  mode?: "upload" | "view"
  hasExistingAnswer?: boolean
  allowOverwrite?: boolean
  disabledReason?:
    "row" | "column" | "position" | "existing_answer" | "absent_student"
  onTogglePosition?: () => void
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

// ファイル状態管理用の型定義。DnD の移動 from/to はセル座標（移動先は空マス＝実体が
// 無いこともある）なので、実体ではなく id（examStudentId, examPageId）で持つ。
export interface FileState {
  fileId: string
  examStudentId: string | null
  examPageId: string | null
}

// ドラッグ&ドロップフックの引数型。upload/view とも AnswerImageIdentity で流れる。
export interface UseDragDropParams<
  TItem extends AnswerImageIdentity = AnswerImageIdentity,
> {
  files: TItem[]
  onFilesChange: (files: TItem[]) => void
  getEnabledFiles: () => TItem[]
  getDisabledFiles: () => TItem[]
  students?: StudentAnswerDatasetExamStudent[]
  examPages?: ExamPageColumn[]
  mode?: "upload" | "view"
  fileOrder?: PlacementStrategy
  onReloadData?: () => void
  onUpdatePendingChanges?: (
    changedFiles: Array<{
      fileId: string
      fromState: FileState
      toState: FileState
    }>
  ) => void
  // view 方式B の差分基準（DB 上の答案 = PlacedAnswerImage 実体をそのまま渡す）。
  // 可変 ref ではなくこれと突き合わせる。読み取り契約は AnswerImageIdentity。
  existingAnswers?: AnswerImageIdentity[]
}

// ドラッグ&ドロップフックの戻り値型
export interface UseDragDropReturn<
  TItem extends AnswerImageIdentity = AnswerImageIdentity,
> {
  sensors: SensorDescriptor<SensorOptions>[]
  activeFile: TItem | null
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
}

// ============================================================================
// answer-table コンポーネントの型定義
// ============================================================================

/** upload / view の答案テーブルが共有する基底プロパティ */
interface AnswerTableBaseProps {
  examId: string
  students: StudentAnswerDatasetExamStudent[]
  examPages: ExamPageColumn[]
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  onReloadData?: () => void
  // 既存答案（PlacedAnswerImage 実体をそのまま渡す）。upload では占有信号、view では
  // DnD 差分の DB baseline として使う。読み取り契約は AnswerImageIdentity（id で同定）。
  existingAnswers?: AnswerImageIdentity[]
}

/** アップロード（新規追加）モードのテーブル。ファイルは未保存の UnsavedAnswerImage。 */
export interface UploadAnswerTableProps extends AnswerTableBaseProps {
  files: UnsavedAnswerImage[]
  fileOrder?: PlacementStrategy
  isUploading?: boolean
  onFileOrderChange?: (order: PlacementStrategy) => void
  onFilesChange: (files: UnsavedAnswerImage[]) => void
  onUpload: (data: UploadData[]) => void

  // マーカー補正状態（親フックから注入）
  markerCorrectionEnabled?: boolean
  markerCorrectionAvailable?: boolean
  markerDiagnostics?: string
  markerAvailableExamPageIds?: Set<string>
  onMarkerCorrectionChange?: (enabled: boolean) => void
}

/** 確認（配置済み答案）モードのテーブル。ファイルは保存済み実体 PlacedAnswerImage。 */
export interface ViewAnswerTableProps extends AnswerTableBaseProps {
  files: PlacedAnswerImage[]
  onFilesChange: (files: PlacedAnswerImage[]) => void
  affectedCells?: Set<string>
  onUpdatePendingChanges?: (
    changedFiles: Array<{
      fileId: string
      fromState: FileState
      toState: FileState
    }>
  ) => void
}

export type DisabledReason =
  | "row"
  | "column"
  | "position"
  | "existing_answer"
  | "absent_student"
  | undefined
