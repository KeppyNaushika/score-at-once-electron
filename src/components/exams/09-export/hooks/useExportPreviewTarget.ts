"use client"

import { useState } from "react"

interface UseExportPreviewTargetOptions {
  /** 出力対象の生徒（並びは選択集合の順） */
  selectedExamStudentIds: string[]
  selectedStudents: Set<string>
  toggleStudent: (examStudentId: string) => void
  removeStudents: (examStudentIds: string[]) => void
  replaceSelection: (examStudentIds: string[]) => void
}

/**
 * プレビューに出す生徒と、プレビューの読み直しの合図。
 *
 * プレビュー対象の生徒は個人成績表と採点済み答案で共通。生徒セレクタは1つしか
 * 無いので、タブごとに別々の状態を持つと「別の生徒を見ている」状態が生まれる。
 *
 * 出力対象を変える操作（トグル・除外・差し替え）は、ここで包んでから渡す。
 * 外れた生徒をプレビューで選んだままにしないため。
 */
export function useExportPreviewTarget({
  selectedExamStudentIds,
  selectedStudents,
  toggleStudent,
  removeStudents,
  replaceSelection,
}: UseExportPreviewTargetOptions) {
  const [pickedStudentId, setPickedStudentId] = useState<string | null>(null)
  const previewStudentId =
    pickedStudentId && selectedExamStudentIds.includes(pickedStudentId)
      ? pickedStudentId
      : (selectedExamStudentIds[0] ?? null)

  // タブへ戻るたびに増やす読み直しの合図。出力はデータを読み直すので、
  // 取得済みのまま据え置くとプレビューと出力が食い違う。
  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const reloadPreview = () => setPreviewReloadKey((key) => key + 1)

  /** 出力対象から外れた生徒はプレビューの選択ごと捨てる（戻したときに跳ばない） */
  const dropPickIfRemoved = (
    isStillSelected: (studentId: string) => boolean
  ) => {
    if (pickedStudentId && !isStillSelected(pickedStudentId)) {
      setPickedStudentId(null)
    }
  }

  const toggleStudentDroppingPick = (examStudentId: string) => {
    dropPickIfRemoved(
      (pickedId) =>
        pickedId !== examStudentId || !selectedStudents.has(examStudentId)
    )
    toggleStudent(examStudentId)
  }

  const removeStudentsDroppingPick = (examStudentIds: string[]) => {
    dropPickIfRemoved((pickedId) => !examStudentIds.includes(pickedId))
    removeStudents(examStudentIds)
  }

  const replaceSelectionDroppingPick = (examStudentIds: string[]) => {
    dropPickIfRemoved((pickedId) => examStudentIds.includes(pickedId))
    replaceSelection(examStudentIds)
  }

  return {
    previewStudentId,
    setPickedStudentId,
    previewReloadKey,
    reloadPreview,
    toggleStudentDroppingPick,
    removeStudentsDroppingPick,
    replaceSelectionDroppingPick,
  }
}
