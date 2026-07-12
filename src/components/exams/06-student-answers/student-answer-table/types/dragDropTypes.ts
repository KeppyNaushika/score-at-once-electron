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
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

// ファイル状態管理用の型定義。DnD の移動 from/to はセル座標（移動先は空マス＝実体が
// 無いこともある）なので、実体ではなく id（studentId, examPageId）で持つ。
export interface FileState {
  fileId: string
  studentId: string | null
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
  students?: ExamStudentWithMemberships[]
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
