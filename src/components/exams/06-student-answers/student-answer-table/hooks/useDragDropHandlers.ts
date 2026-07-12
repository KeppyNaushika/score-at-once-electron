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
  AnswerItem,
  PlacementStrategy,
} from "@/components/exams/06-student-answers/types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

interface UseDragDropHandlersParams<TItem extends AnswerItem> {
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
  existingStudentAnswers?: Array<{
    id: string
    studentId: string | null
    pageNumber: number
  }>
  setActiveFile: (file: TItem | null) => void
}

/**
 * ドラッグ&ドロップのイベントハンドラーを管理するカスタムフック
 */
export function useDragDropHandlers<TItem extends AnswerItem>({
  files,
  onFilesChange,
  getEnabledFiles,
  getDisabledFiles,
  students,
  modelAnswerCount,
  mode,
  onUpdatePendingChanges,
  existingStudentAnswers,
  setActiveFile,
}: UseDragDropHandlersParams<TItem>) {
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

        // 方式B の drop 先は「マス」（占有マスも空マスも cell: droppable）だけ。
        // 孤立答案カードは draggable のみ（droppable ではない）ので over にならない。
        // よって対象セル座標は droppable ID から一意に復号できる。
        const target = decodeCellDroppableId(overId)
        if (!target) {
          setActiveFile(null)
          return
        }

        // 「そのマスに配置できる座標か」（除籍生徒＝名簿外／ページ範囲外を弾く）。
        // 移動元が孤立答案（配置不能座標）なら占有マスへの swap を拒否するために使う。
        const rosterStudentIds = new Set(
          (students ?? []).map((examStudent) => examStudent.studentId)
        )
        const isPlaceable = (
          studentId: string | undefined,
          pageNumber: number
        ): boolean =>
          !!studentId &&
          rosterStudentIds.has(studentId) &&
          pageNumber >= 1 &&
          pageNumber <= (modelAnswerCount ?? 0)

        // 移動元（ドラッグした答案）が配置可能座標か。孤立答案なら false → 占有セルへの swap を拒否。
        const activeItem = files.find((file) => file.id === activeId)
        const isSourcePlaceable = activeItem
          ? isPlaceable(activeItem.studentId, activeItem.pageNumber)
          : false

        // 占有判定は「表に見えている答案」だけに限定する（trash 等の隠れ答案を巻き込まない）
        const enabledFileIds = new Set(getEnabledFiles().map((file) => file.id))
        const newFiles = applyCellMoveOrSwap(
          files,
          activeId,
          target,
          enabledFileIds,
          isSourcePlaceable
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
        // 同一コンテナ内のファイル（main=有効 / trash=無効）だけを並べ替え対象にする。
        // 全 files を arrayMove すると、old〜new index 間に挟まった trash スロットへ
        // 隣接スロットの studentId/pageNumber が誤って再代入される（#964）。
        const containerFiles =
          activeContainer === "main" ? getEnabledFiles() : getDisabledFiles()
        const oldIndex = containerFiles.findIndex(
          (file) => file.id === activeId
        )
        const newIndex = containerFiles.findIndex((file) => file.id === overId)

        if (oldIndex !== -1 && newIndex !== -1) {
          // fileId のみを入れ替え、各スロット（元の位置）の studentId/pageNumber は固定
          const reorderedFileIds = arrayMove(
            containerFiles.map((file) => file.id),
            oldIndex,
            newIndex
          )

          // 各スロット id → 移動後の fileId のファイル（座標は元スロットのまま）
          const remappedBySlotId = new Map(
            containerFiles.map((slot, index) => [
              slot.id,
              {
                ...files.find((file) => file.id === reorderedFileIds[index])!,
                studentId: slot.studentId,
                pageNumber: slot.pageNumber,
              },
            ])
          )

          // 元の files 並びを保ち、当該コンテナのスロットのみ差し替える（trash は据え置き）
          const reorderedFiles = files.map(
            (file) => remappedBySlotId.get(file.id) ?? file
          )

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
      students,
      modelAnswerCount,
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
