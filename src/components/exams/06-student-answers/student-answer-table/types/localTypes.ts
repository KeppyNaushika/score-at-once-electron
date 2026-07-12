import type {
  AnswerItem,
  PendingImage,
  PlacementStrategy,
  UploadData,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

import type { FileState } from "./dragDropTypes"

// ============================================================================
// answer-table コンポーネントの型定義
// ============================================================================

/** upload / view の答案テーブルが共有する基底プロパティ */
export interface AnswerTableBaseProps {
  examId: string
  students: ExamStudentWithMemberships[]
  modelAnswerCount: number
  imageLoadStates?: Record<string, "pending" | "loading" | "loaded" | "error">
  onReloadData?: () => void
  // upload: 既存答案の占有信号 / view: DnD 差分の DB baseline
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
}

/** アップロード（新規追加）モードのテーブル。ファイルは未保存の PendingImage。 */
export interface UploadAnswerTableProps extends AnswerTableBaseProps {
  files: PendingImage[]
  fileOrder?: PlacementStrategy
  isUploading?: boolean
  onFileOrderChange?: (order: PlacementStrategy) => void
  onFilesChange: (files: PendingImage[]) => void
  onUpload: (data: UploadData[]) => void

  // マーカー補正状態（親フックから注入）
  markerCorrectionEnabled?: boolean
  markerCorrectionAvailable?: boolean
  markerDiagnostics?: string
  markerAvailablePages?: Set<number>
  onMarkerCorrectionChange?: (enabled: boolean) => void
}

/** 確認（配置済み答案）モードのテーブル。ファイルは DB答案の投射 AnswerItem。 */
export interface ViewAnswerTableProps extends AnswerTableBaseProps {
  files: AnswerItem[]
  onFilesChange: (files: AnswerItem[]) => void
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
