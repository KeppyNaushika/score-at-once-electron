import { useDragDropHandlers } from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks/use-drag-drop-handlers"
import { useDragDropState } from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks/use-drag-drop-state"
import type {
  UseDragDropParams,
  UseDragDropReturn,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/types/drag-drop-types"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useCallback } from "react"

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
  const { handleDragStart, handleDragOver, handleDragEnd } =
    useDragDropHandlers({
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

  // キャンセル時に初期状態に戻すリセット関数
  const resetToInitialState = useCallback(() => {
    if (mode === "view" && initialFileStatesRef.current.length > 0) {
      const resetFiles = buildDnDArray(
        initialFileStatesRef.current,
        fileOrder || "page-first",
      )
      if (resetFiles.length > 0) {
        onFilesChange(resetFiles)
        fileStatesRef.current = [...initialFileStatesRef.current]
      }
    }
  }, [
    mode,
    fileOrder,
    buildDnDArray,
    onFilesChange,
    fileStatesRef,
    initialFileStatesRef,
  ])

  return {
    sensors,
    activeFile,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    resetToInitialState,
  }
}
