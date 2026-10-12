/**
 * 類型評価（類型の組）の編集の書き込み（docs/vlm-grading-design.md §4-8-3a）。
 *
 * 名前・記号・説明・点数は1打鍵ごとに書く。打鍵と取り直しが競り合うので、入力中の文字は
 * 手元に持つ（`useEditingText`）。点数は数にできない途中（空欄・`-` など）を書かない。
 * 点数を直す・類型を足す・類型を消すは、共通の組なら先に確かめる（`useGlobalScaleEditGate`）。
 */

import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"

import { useEditingText } from "@/hooks/useEditingText"
import {
  createScoreScaleLevelMutation,
  deleteScoreScaleLevelMutation,
  reorderScoreScaleLevelsMutation,
  type ScoreScaleLevelRow,
  type ScoreScaleRow,
  updateScoreScaleLevelMutation,
  updateScoreScaleMutation,
} from "@/queries/scoreScale"

import { moveScaleLevel, readScoreInput } from "../utils/scoreScaleUsage"
import {
  type GatedScaleEdit,
  type ScaleEditTarget,
  useGlobalScaleEditGate,
} from "./useGlobalScaleEditGate"

/** 1打鍵ごとに書く類型の文字の欄（点数は別。数として読む） */
type ScaleLevelTextField = "label" | "description"

interface UseScoreScaleEditingOptions {
  scoreScale: ScoreScaleRow
  contextExamId: string | null
}

export function useScoreScaleEditing({
  scoreScale,
  contextExamId,
}: UseScoreScaleEditingOptions) {
  const { textOf, remember, forgetField } = useEditingText()
  const { mutate: updateScoreScale } = useMutation(updateScoreScaleMutation())
  const { mutate: createLevel } = useMutation(createScoreScaleLevelMutation())
  const { mutate: updateLevel } = useMutation(updateScoreScaleLevelMutation())
  const { mutate: deleteLevel } = useMutation(deleteScoreScaleLevelMutation())
  const { mutate: reorderLevels } = useMutation(
    reorderScoreScaleLevelsMutation()
  )

  const applyEdit = useCallback(
    (edit: GatedScaleEdit, target: ScaleEditTarget) => {
      if (edit.kind === "addLevel") {
        createLevel({
          scaleId: target.id,
          label: "",
          description: "",
          score: 0,
        })
        return
      }
      const targetLevel = target.levels[edit.levelIndex]
      if (!targetLevel) return
      if (edit.kind === "score") {
        updateLevel({
          scaleLevelId: targetLevel.id,
          data: { score: edit.score },
        })
        return
      }
      deleteLevel(targetLevel.id)
    },
    [createLevel, updateLevel, deleteLevel]
  )

  /** 確認をやめたら、打ちかけの点数を捨てて保存されている値へ戻す */
  const handleGateCancelled = useCallback(
    (edit: GatedScaleEdit) => {
      if (edit.kind !== "score") return
      const level = scoreScale.levels[edit.levelIndex]
      if (level) forgetField(level.id, "score")
    },
    [scoreScale.levels, forgetField]
  )

  const gate = useGlobalScaleEditGate({
    scoreScale,
    contextExamId,
    applyEdit,
    onCancelled: handleGateCancelled,
  })

  /**
   * 入力を離れたら、その欄の手元の文字を捨てる。ただし確認を待っている間は捨てない。
   * 確認のダイアログが開くと焦点がそちらへ移って欄の blur が来るが、その時点で捨てると
   * 「続けて直す」のあとに打ちかけの点数が保存前の値へ戻ってしまう（やめたときは確認の側が捨てる）
   */
  const leaveField = (rowId: string, field: string) => {
    if (gate.isHolding()) return
    forgetField(rowId, field)
  }

  const changeName = (text: string) => {
    remember(scoreScale.id, "name", text)
    updateScoreScale({ scoreScaleId: scoreScale.id, name: text })
  }

  const changeLevelText = (
    level: ScoreScaleLevelRow,
    field: ScaleLevelTextField,
    text: string
  ) => {
    remember(level.id, field, text)
    updateLevel({
      scaleLevelId: level.id,
      data: field === "label" ? { label: text } : { description: text },
    })
  }

  const changeScore = (levelIndex: number, text: string) => {
    const level = scoreScale.levels[levelIndex]
    if (!level) return
    remember(level.id, "score", text)
    const scoreInput = readScoreInput(text)
    if (scoreInput.kind === "incomplete") return
    gate.requestEdit({ kind: "score", levelIndex, score: scoreInput.score })
  }

  const moveLevel = (fromIndex: number, toIndex: number) => {
    reorderLevels({
      scaleId: scoreScale.id,
      orders: moveScaleLevel(
        scoreScale.levels.map((level) => level.id),
        fromIndex,
        toIndex
      ),
    })
  }

  return {
    textOf,
    leaveField,
    changeName,
    changeLevelText,
    changeScore,
    addLevel: () => gate.requestEdit({ kind: "addLevel" }),
    deleteLevel: (levelIndex: number) =>
      gate.requestEdit({ kind: "deleteLevel", levelIndex }),
    moveLevel,
    gate,
  }
}
