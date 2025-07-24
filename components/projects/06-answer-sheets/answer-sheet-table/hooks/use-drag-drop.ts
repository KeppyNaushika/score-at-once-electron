import type {
  UseDragDropParams,
  UseDragDropReturn,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/types/drag-drop-types"
import { useDragDropHandlers } from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks/use-drag-drop-handlers"
import { useDragDropState } from "@/components/projects/06-answer-sheets/answer-sheet-table/hooks/use-drag-drop-state"
import {
  buildDnDArrayFromFileStates,
  compareFileStates,
} from "@/components/projects/06-answer-sheets/answer-sheet-table/utils/drag-drop-utils"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { useCallback } from "react"
import { toast } from "sonner"

/**
 * ドラッグ&ドロップ機能を提供するメインフック（リファクタリング版）
 */
export function useDragDrop({
  files,
  onFilesChange,
  getEnabledFiles,
  getDisabledFiles,
  disabledState,
  setDisabledState,
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
    isDraggingFromTrash,
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
      disabledState,
      setDisabledState,
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

  // 確認モードでの答案配置交換（安全なユニーク制約回避）
  const swapAnswerSheetInDatabase = useCallback(
    async (file1: any, file2: any) => {
      // APIが利用可能かチェック
      if (
        !window.electronAPI ||
        !window.electronAPI.swapAnswerSheetPlacements
      ) {
        console.error(
          "swapAnswerSheetPlacements API is not available. Please restart the Electron app.",
        )
        toast.error("APIが利用できません。アプリを再起動してください。")
        return
      }

      try {
        const result = await window.electronAPI.swapAnswerSheetPlacements(
          file1.id,
          file2.id,
        )

        if (result.success) {
          toast.success(`答案の配置を交換しました`)
          onReloadData?.()
        } else {
          toast.error(`配置交換に失敗しました: ${result.error}`)
        }
      } catch (error) {
        console.error("Error swapping answer sheet placements:", error)
        toast.error("配置交換中にエラーが発生しました")
      }
    },
    [onReloadData],
  )

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
  }, [mode, fileOrder, buildDnDArray, onFilesChange, fileStatesRef, initialFileStatesRef])

  return {
    sensors,
    activeFile,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    resetToInitialState,
  }
}