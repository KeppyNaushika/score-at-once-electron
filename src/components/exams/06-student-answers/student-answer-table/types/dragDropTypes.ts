import type {
  DragEndEvent,
  DragStartEvent,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core"

import type {
  AnswerItem,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

// ファイル状態管理用の型定義
export interface FileState {
  fileId: string
  studentId: string | null
  pageNumber: number
}

// ドラッグ&ドロップフックの引数型。upload は PendingImage、view は AnswerItem で流れる。
export interface UseDragDropParams<TItem extends AnswerItem = AnswerItem> {
  files: TItem[]
  onFilesChange: (files: TItem[]) => void
  getEnabledFiles: () => TItem[]
  getDisabledFiles: () => TItem[]
  students?: ExamStudentWithMemberships[]
  modelAnswerCount?: number
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
  // view 方式B の差分基準（DB 上の答案座標）。可変 ref ではなくこれと突き合わせる。
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
}

// ドラッグ&ドロップフックの戻り値型
export interface UseDragDropReturn<TItem extends AnswerItem = AnswerItem> {
  sensors: SensorDescriptor<SensorOptions>[]
  activeFile: TItem | null
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
}
