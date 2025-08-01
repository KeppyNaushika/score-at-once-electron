import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/types/student-answer.types"

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
    changedFiles: Array<{ fileId: string; fromState: any; toState: any }>,
  ) => void
}

// ドラッグ&ドロップフックの戻り値型
export interface UseDragDropReturn {
  sensors: any
  activeFile: UnifiedFile | null
  handleDragStart: (event: any) => void
  handleDragEnd: (event: any) => void
}
