import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback } from "react"
import { toast } from "sonner"

import type { FileState } from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import {
  applyCellMoveOrSwap,
  decodeCellDroppableId,
  diffFilesAgainstBaseline,
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
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
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
  mode,
  onUpdatePendingChanges,
  existingStudentAnswers,
  setActiveFile,
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

      // 確認モード（方式B）: 対象セル座標へ move、占有セルなら swap。
      // over は空セルの droppable（cell:...）か、占有セルのファイル（fileId）。
      // どちらでも対象セルの (studentId, pageNumber) を求め、座標だけ更新する。
      if (mode === "view") {
        // 差分は DB baseline（existingStudentAnswers）と突き合わせて毎回算出する。
        // これが無いと配置変更を pending として記録できない＝黙って取りこぼすので、
        // 記録できない場合は見た目も動かさない（onFilesChange を呼ばない）。
        if (!existingStudentAnswers || !onUpdatePendingChanges) {
          setActiveFile(null)
          return
        }

        const target =
          decodeCellDroppableId(overId) ??
          (() => {
            const overFile = files.find((file) => file.id === overId)
            return overFile?.studentId
              ? {
                  studentId: overFile.studentId,
                  pageNumber: overFile.pageNumber,
                }
              : null
          })()

        if (!target) {
          setActiveFile(null)
          return
        }

        // 占有判定は「表に見えている答案」だけに限定する（trash 等の隠れ答案を巻き込まない）
        const enabledFileIds = new Set(getEnabledFiles().map((file) => file.id))
        const newFiles = applyCellMoveOrSwap(
          files,
          activeId,
          target,
          enabledFileIds
        )
        if (newFiles === files) {
          // 実質変更なし（同一セルへのドロップのみ通知。対象/アクティブ不明時は無言）
          if (files.some((file) => file.id === activeId)) {
            toast.info("元の位置に戻されました")
          }
          setActiveFile(null)
          return
        }

        onFilesChange(newFiles)

        // 可変 ref ではなく DB baseline との差分（累積・全置換で安全）
        const changedFiles = diffFilesAgainstBaseline(
          newFiles,
          existingStudentAnswers
        )
        onUpdatePendingChanges(changedFiles)

        if (changedFiles.length > 0) {
          toast.success(`${changedFiles.length}件の答案配置を変更しました`, {
            description: "「変更を反映」ボタンで確定してください",
          })
        } else {
          toast.info("元の位置に戻されました")
        }

        setActiveFile(null)
        return
      }

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

      // アップロードモード（方式A）: arrayMove で並べ替え、各位置の studentId/pageNumber は固定。
      // 新規ファイルの自動配置順を手で入れ替えるための経路（view の座標 move/swap とは別物）。
      if (activeContainer === overContainer && activeId !== overId) {
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
          toast.success("答案の配置を変更しました")
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
      onUpdatePendingChanges,
      existingStudentAnswers,
      setActiveFile,
    ]
  )

  return {
    handleDragStart,
    handleDragEnd,
  }
}
