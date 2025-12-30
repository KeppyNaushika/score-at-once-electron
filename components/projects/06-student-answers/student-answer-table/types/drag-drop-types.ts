import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/components/projects/06-student-answers/types"
import type {
  DragEndEvent,
  DragStartEvent,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core"

// ファイル状態管理用の型定義
export interface FileState {
  fileId: string
  studentId: string | null
  pageNumber: number
}

// ドラッグ&ドロップフックの引数型
export interface UseDragDropParams {
  files: UnifiedFile[]
  onFilesChange: (files: UnifiedFile[]) => void
  getEnabledFiles: () => UnifiedFile[]
  getDisabledFiles: () => UnifiedFile[]
  students?: UnifiedStudent[]
  modelAnswerCount?: number
  mode?: "upload" | "view"
  fileOrder?: PlacementStrategy
  onReloadData?: () => void
  onUpdatePendingChanges?: (
    changedFiles: Array<{ fileId: string; fromState: FileState; toState: FileState }>,
  ) => void
}

// ドラッグ&ドロップフックの戻り値型
export interface UseDragDropReturn {
  sensors: SensorDescriptor<SensorOptions>[]
  activeFile: UnifiedFile | null
  handleDragStart: (event: DragStartEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
}
