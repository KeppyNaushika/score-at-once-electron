import { useDragDropHandlers } from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks/use-drag-drop-handlers"
import { useDragDropState } from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks/use-drag-drop-state"
import type {
  UseDragDropParams,
  UseDragDropReturn,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/types/drag-drop-types"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"

/**
 * ドラッグ&ドロップ機能を提供するメインフック（リファクタリング版）
 */
export function useDragDrop({
  files,
  onFilesChange,
  getEnabledFiles,
  getDisabledFiles,
  students,
  masterImageCount,
  mode,
  fileOrder,
  onReloadData,
  onUpdatePendingChanges,
}: UseDragDropParams): UseDragDropReturn {
  // 状態管理
  const {
    activeFile,
    setActiveFile,
    setIsDraggingFromTrash,
    fileStatesRef,
    initialFileStatesRef,
    buildDnDArray,
  } = useDragDropState({
    files,
    students,
    masterImageCount,
    mode,
    fileOrder,
    onFilesChange,
  })

  // イベントハンドラー
  const { handleDragStart, handleDragEnd } = useDragDropHandlers({
    files,
    onFilesChange,
    getEnabledFiles,
    getDisabledFiles,
    students,
    masterImageCount,
    mode,
    fileOrder,
    onReloadData,
    onUpdatePendingChanges,
    setActiveFile,
    setIsDraggingFromTrash,
    fileStatesRef,
    initialFileStatesRef,
  })

  // ドラッグ&ドロップセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  return {
    sensors,
    activeFile,
    handleDragStart,
    handleDragEnd,
  }
}
