import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback } from "react"
import { toast } from "sonner"

import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import {
  compareFileStates,
  updateFileStatesFromDnDArray,
} from "@/components/exams/06-student-answers/student-answer-table/utils/dragDropUtils"
import type {
  PlacementStrategy,
  UnifiedFile,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface UseDragDropHandlersParams {
  files: UnifiedFile[]
  onFilesChange: (files: UnifiedFile[]) => void
  getEnabledFiles: () => UnifiedFile[]
  getDisabledFiles: () => UnifiedFile[]
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
  setActiveFile: (file: UnifiedFile | null) => void
  fileStatesRef: React.MutableRefObject<FileState[]>
  initialFileStatesRef: React.MutableRefObject<FileState[]>
}

/**
 * ドラッグ&ドロップのイベントハンドラーを管理するカスタムフック
 */
export function useDragDropHandlers({
  files,
  onFilesChange,
  getEnabledFiles,
  getDisabledFiles,
  students,
  modelAnswerCount,
  mode,
  onUpdatePendingChanges,
  setActiveFile,
  fileStatesRef,
  initialFileStatesRef,
}: UseDragDropHandlersParams) {
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      const activeId = active.id.toString()

      const activeFileFromEnabled = getEnabledFiles().find(
        (file) => file.id === activeId
      )
      const activeFileFromDisabled = getDisabledFiles().find(
        (file) => file.id === activeId
      )

      if (activeFileFromEnabled) {
        setActiveFile(activeFileFromEnabled)
      } else if (activeFileFromDisabled) {
        setActiveFile(activeFileFromDisabled)
      }
    },
    [getEnabledFiles, getDisabledFiles, setActiveFile]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) {
        setActiveFile(null)
        return
      }

      const activeId = active.id.toString()
      const overId = over.id.toString()

      if (activeId === overId) {
        setActiveFile(null)
        return
      }

      // コンテナ判定関数
      const findContainer = (id: string) => {
        if (id === "trash-area" || id === "trash-popover-trigger")
          return "trash"

        const enabledFile = getEnabledFiles().find((file) => file.id === id)
        if (enabledFile) return "main"

        const disabledFile = getDisabledFiles().find((file) => file.id === id)
        if (disabledFile) return "trash"

        return null
      }

      const activeContainer = findContainer(activeId)
      const overContainer = findContainer(overId)

      if (activeContainer === overContainer && activeId !== overId) {
        // 新規追加・確認モード共通: arrayMoveによる順延ロジック
        const newFiles = [...files]
        const oldIndex = newFiles.findIndex((file) => file.id === activeId)
        const newIndex = newFiles.findIndex((file) => file.id === overId)

        if (oldIndex !== -1 && newIndex !== -1) {
          // 1. fileIdのみを入れ替え、各位置のstudentIdとpageNumberは固定
          const originalFiles = [...newFiles]
          const reorderedFileIds = arrayMove(
            newFiles.map((file) => file.id),
            oldIndex,
            newIndex
          )

          // 2. 各位置に対して、新しいfileIdと元の論理位置を組み合わせ
          const reorderedFiles = originalFiles.map((originalFile, index) => ({
            ...files.find((file) => file.id === reorderedFileIds[index])!, // 新しいfileIdのファイルオブジェクト
            studentId: originalFile.studentId, // 元の位置のstudentId
            pageNumber: originalFile.pageNumber, // 元の位置のpageNumber
          }))

          onFilesChange(reorderedFiles)

          // 3. DnD操作時: 配列変更 + 3つ組同期更新（ファイル実データをそのまま使用）
          if (mode === "view") {
            const newFileStates = updateFileStatesFromDnDArray(reorderedFiles)
            fileStatesRef.current = newFileStates
          }

          // 確認モードでは一括でPendingChangeを更新
          if (
            mode === "view" &&
            students &&
            modelAnswerCount &&
            onUpdatePendingChanges &&
            initialFileStatesRef.current.length > 0
          ) {
            // 現在のファイル状態と初期状態を比較
            const currentFileStates = fileStatesRef.current
            const changedFiles = compareFileStates(
              initialFileStatesRef.current,
              currentFileStates
            )

            // 変更されたファイル情報を一括で親に渡す
            onUpdatePendingChanges(changedFiles)

            // ドラッグ操作完了のtoast表示
            if (changedFiles.length > 0) {
              toast.success(
                `${changedFiles.length}件の答案配置を変更しました`,
                {
                  description: "「変更を反映」ボタンで確定してください",
                }
              )
            } else {
              toast.info("元の位置に戻されました")
            }
          } else if (mode === "upload") {
            // upload モードでのドラッグ操作完了のtoast
            toast.success("答案の配置を変更しました")
          }
        }
      }

      setActiveFile(null)
    },
    [
      files,
      onFilesChange,
      getEnabledFiles,
      getDisabledFiles,
      mode,
      students,
      modelAnswerCount,
      onUpdatePendingChanges,
      setActiveFile,
      fileStatesRef,
      initialFileStatesRef,
    ]
  )

  return {
    handleDragStart,
    handleDragEnd,
  }
}
