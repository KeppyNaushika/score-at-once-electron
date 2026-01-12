import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"

import { useDragDropHandlers } from "@/components/projects/06-student-answers/student-answer-table/hooks/useDragDropHandlers"
import { useDragDropState } from "@/components/projects/06-student-answers/student-answer-table/hooks/useDragDropState"
import type {
  UseDragDropParams,
  UseDragDropReturn,
} from "@/components/projects/06-student-answers/student-answer-table/types/dragDropTypes"

/**
 * ドラッグ&ドロップ機能を提供するメインフック（リファクタリング版）
 */
export function useDragDrop({
  files,
  onFilesChange,
  getEnabledFiles,
  getDisabledFiles,
  students,
  modelAnswerCount,
  mode,
  fileOrder,
  onReloadData,
  onUpdatePendingChanges,
}: UseDragDropParams): UseDragDropReturn {
  // 状態管理
  const { activeFile, setActiveFile, fileStatesRef, initialFileStatesRef } =
    useDragDropState({
      files,
      students,
      modelAnswerCount,
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
    modelAnswerCount,
    mode,
    fileOrder,
    onReloadData,
    onUpdatePendingChanges,
    setActiveFile,
    fileStatesRef,
    initialFileStatesRef,
  })

  // ドラッグ&ドロップセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  return {
    sensors,
    activeFile,
    handleDragStart,
    handleDragEnd,
  }
}
