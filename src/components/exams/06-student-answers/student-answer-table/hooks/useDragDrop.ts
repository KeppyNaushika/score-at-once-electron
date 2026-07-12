import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"

import { useDragDropHandlers } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDragDropHandlers"
import { useDragDropState } from "@/components/exams/06-student-answers/student-answer-table/hooks/useDragDropState"
import type {
  UseDragDropParams,
  UseDragDropReturn,
} from "@/components/exams/06-student-answers/student-answer-table/types/dragDropTypes"
import type { AnswerImageIdentity } from "@/components/exams/06-student-answers/types"

/**
 * ドラッグ&ドロップ機能を提供するメインフック（リファクタリング版）
 */
export function useDragDrop<TItem extends AnswerImageIdentity>({
  files,
  onFilesChange,
  getEnabledFiles,
  getDisabledFiles,
  students,
  examPages,
  mode,
  fileOrder,
  onReloadData,
  onUpdatePendingChanges,
  existingAnswers,
}: UseDragDropParams<TItem>): UseDragDropReturn<TItem> {
  // 状態管理（アクティブなドラッグ対象のみ）
  const { activeFile, setActiveFile } = useDragDropState<TItem>()

  // イベントハンドラー
  const { handleDragStart, handleDragEnd } = useDragDropHandlers({
    files,
    onFilesChange,
    getEnabledFiles,
    getDisabledFiles,
    students,
    examPages,
    mode,
    fileOrder,
    onReloadData,
    onUpdatePendingChanges,
    existingAnswers,
    setActiveFile,
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
