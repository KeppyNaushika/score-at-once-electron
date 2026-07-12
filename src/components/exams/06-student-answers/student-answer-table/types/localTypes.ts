import type {
  ExamPageColumn,
  PlacementStrategy,
  UnsavedAnswerImage,
  UploadData,
} from "@/components/exams/06-student-answers/types"
import type {
  ExamStudentWithMemberships,
  PlacedAnswerImage,
} from "@/types/prismaExtensions"

import type { AnswerCellBaseline, FileState } from "./dragDropTypes"

// ============================================================================
// answer-table コンポーネントの型定義
// ============================================================================

/** upload / view の答案テーブルが共有する基底プロパティ */
export interface AnswerTableBaseProps {
  examId: string
  students: ExamStudentWithMemberships[]
  examPages: ExamPageColumn[]
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  onReloadData?: () => void
  // upload: 既存答案の占有信号 / view: DnD 差分の DB baseline（いずれも id で同定）
  existingAnswers?: AnswerCellBaseline[]
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
  markerAvailablePages?: Set<number>
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
