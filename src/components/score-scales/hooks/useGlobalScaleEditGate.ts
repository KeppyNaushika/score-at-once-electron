/**
 * 共通の類型評価の点数・類型を直す前の確認（docs/vlm-grading-design.md §4-8-3a）。
 *
 * 共通の組を直すと、使っているすべての試験の点が変わる（点は保存せず、読むときに類型の点数を引くため）。
 * そこで、使っている設問のある共通の組で、点数を直す・類型を足す・類型を消す前に
 * 「N 試験・M 設問で使っています」と示して確かめる。記号・説明・名前は点に関わらないので確かめない。
 *
 * 点数は1打鍵ごとに書くので、打鍵ごとには聞けない。**組ごとに、この編集の画面を開いている間に
 * 1度だけ**聞き、「続けて直す」を選んだ組はそれ以降聞かない。
 *
 * 03 から開いたときは「この試験用に複製して直す」も選べる。その試験の設問を複製へ付け替え、
 * 止めていた変更を複製の側に当てる（類型は並びの位置で対応させる。複製は並びをそのまま写す）。
 */

import { useMutation } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"

import {
  duplicateScoreScaleMutation,
  type ScoreScaleRow,
} from "@/queries/scoreScale"

import { needsGlobalEditConfirmation } from "../utils/scoreScaleUsage"

/** 点に関わる変更（確かめる対象）。類型は並びの位置で指す（複製へも同じ位置で当てる） */
export type GatedScaleEdit =
  | { kind: "score"; levelIndex: number; score: number }
  | { kind: "addLevel" }
  | { kind: "deleteLevel"; levelIndex: number }

/** 変更を当てる先の組（元の組か、その複製） */
export type ScaleEditTarget = Pick<ScoreScaleRow, "id"> & {
  levels: Pick<ScoreScaleRow["levels"][number], "id">[]
}

interface UseGlobalScaleEditGateOptions {
  scoreScale: ScoreScaleRow
  /** 03 から開いたときの試験（複製して直すときの持ち主）。管理の画面では null */
  contextExamId: string | null
  /** 変更を書く */
  applyEdit: (edit: GatedScaleEdit, target: ScaleEditTarget) => void
  /** 確認を「やめる」で閉じたとき（打ちかけの点数を捨てる） */
  onCancelled: (edit: GatedScaleEdit) => void
}

export function useGlobalScaleEditGate({
  scoreScale,
  contextExamId,
  applyEdit,
  onCancelled,
}: UseGlobalScaleEditGateOptions) {
  const [pendingEdit, setPendingEdit] = useState<GatedScaleEdit | null>(null)
  /**
   * 確認を待っている変更の、いまの値。ボタンで閉じると、ボタンの処理に続けて同じ操作のうちに
   * ダイアログの「閉じた」（`onOpenChange(false)` → `cancel`）も来る。state は描き直すまで
   * 古いままなので、`cancel` が済んだ変更を「やめた」と取り違えて打ちかけの点数を捨てていた。
   * 済んだかどうかはこちらで同期的に持つ
   */
  const pendingEditRef = useRef<GatedScaleEdit | null>(null)
  const holdEdit = useCallback((edit: GatedScaleEdit | null) => {
    pendingEditRef.current = edit
    setPendingEdit(edit)
  }, [])
  /** 「続けて直す」を選んだ組。この画面を開いている間は聞き直さない */
  const [acknowledgedScaleIds, setAcknowledgedScaleIds] = useState<
    ReadonlySet<string>
  >(new Set())
  const { mutateAsync: duplicateScoreScale } = useMutation(
    duplicateScoreScaleMutation(contextExamId)
  )

  const requestEdit = useCallback(
    (edit: GatedScaleEdit) => {
      if (
        !needsGlobalEditConfirmation(scoreScale) ||
        acknowledgedScaleIds.has(scoreScale.id)
      ) {
        applyEdit(edit, scoreScale)
        return
      }
      holdEdit(edit)
    },
    [scoreScale, acknowledgedScaleIds, applyEdit, holdEdit]
  )

  const continueEditing = useCallback(() => {
    const heldEdit = pendingEditRef.current
    if (heldEdit === null) return
    setAcknowledgedScaleIds((prev) => new Set(prev).add(scoreScale.id))
    holdEdit(null)
    applyEdit(heldEdit, scoreScale)
  }, [scoreScale, applyEdit, holdEdit])

  /** この試験用に複製し、この試験の設問を付け替えてから、止めていた変更を複製に当てる */
  const duplicateAndEdit = useCallback(async () => {
    const heldEdit = pendingEditRef.current
    if (heldEdit === null || contextExamId === null) return
    holdEdit(null)
    const reassignCropRegionIds = scoreScale.cropRegions
      .filter((cropRegion) => cropRegion.examPage.examId === contextExamId)
      .map((cropRegion) => cropRegion.id)
    try {
      const duplicated = await duplicateScoreScale({
        scoreScaleId: scoreScale.id,
        examId: contextExamId,
        reassignCropRegionIds,
      })
      applyEdit(heldEdit, duplicated)
    } catch {
      // 失敗の通知は MutationCache の後始末が担う。変更は当てない
      onCancelled(heldEdit)
    }
  }, [
    holdEdit,
    contextExamId,
    scoreScale,
    duplicateScoreScale,
    applyEdit,
    onCancelled,
  ])

  const cancel = useCallback(() => {
    const heldEdit = pendingEditRef.current
    if (heldEdit === null) return
    holdEdit(null)
    onCancelled(heldEdit)
  }, [onCancelled, holdEdit])

  /** 確認を待っている変更があるか（描き直しを待たずに読む） */
  const isHolding = useCallback(() => pendingEditRef.current !== null, [])

  return {
    pendingEdit,
    isHolding,
    requestEdit,
    continueEditing,
    /** 03 から開いたときだけ選べる */
    duplicateAndEdit: contextExamId === null ? null : duplicateAndEdit,
    cancel,
  }
}
