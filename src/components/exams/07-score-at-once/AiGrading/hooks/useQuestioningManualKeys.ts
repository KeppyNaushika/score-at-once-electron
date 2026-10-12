/**
 * 問いかけの「自分で採点する」のキー（docs/vlm-grading-design.md §3-5・§11-4）。
 *
 * カードの答案を ←→ で移り、いつもの採点キー（英字の採点状態・数字で部分点の入力欄）か
 * パネルの採点ボタンで、焦点のある答案に点を付ける。**付けた点は下書き**で（ここでは書かない）、
 * 問いの答えとして残し、見直しの「確定する」で入る。
 *
 * 部分点の入力欄は一覧表示と同じもの（`usePartialScore`）を、焦点のある答案1件を選んだものとして使う。
 *
 * 類型方式の設問（§4-8-5）では、数字キー 1〜9 が類型を並び順に選び（1 が先頭。部分点の入力は始めない）、
 * 正答・誤答・部分点のキーは付けずに 07 と同じ知らせを出す。保留・無答などのキーは効く（点は持たない）。
 */

import { useMemo } from "react"
import { toast } from "sonner"

import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { usePartialScoreShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/usePartialScoreShortcuts"
import { usePartialScore } from "@/components/exams/07-score-at-once/ScoringMain/hooks/usePartialScore"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { ScaleQuestionState } from "../../ScaleLevel/hooks/useScaleScoringGate"
import {
  POINT_VERDICT_ON_SCALE_NOTICE,
  SCALE_NOT_SELECTED_NOTICE,
} from "../../ScaleLevel/scaleLevelMessages"
import { scaleLevelOfDigit } from "../../ScaleLevel/utils/scaleLevelAppearance"
import type { QuestioningScore } from "../utils/questioningSteps"
import { AI_GRADING_MODE_CONDITION } from "./useAiGradingShortcuts"
import {
  useChoiceScenePartialStartCommands,
  useStatusScoringCommands,
} from "./useAiScoringKeyCommands"

interface UseQuestioningManualKeysOptions {
  /** 自分で採点している最中か（キーを効かせるか） */
  isActive: boolean
  cropRegion: QuestionAnswerRegionRow
  /** 設問が類型方式か・その類型 */
  scaleQuestion: ScaleQuestionState
  /** 焦点のある答案（受験者）。無ければ null */
  cursorExamStudentId: string | null
  /** 焦点のある答案の、いま付けてある点（部分点・保留のキーが点を引き継ぐ） */
  cursorScore: QuestioningScore | null
  /** 焦点を前後へ */
  onMove: (step: -1 | 1) => void
  /** 焦点のある答案に点を付けた（下書き） */
  onScore: (score: QuestioningScore) => void
}

const MANUAL_CONDITION = `${AI_GRADING_MODE_CONDITION} && aiQuestioningManual`

export function useQuestioningManualKeys({
  isActive,
  cropRegion,
  scaleQuestion,
  cursorExamStudentId,
  cursorScore,
  onMove,
  onScore,
}: UseQuestioningManualKeysOptions) {
  useContextValue("aiQuestioningManual", isActive)
  const condition = isActive ? MANUAL_CONDITION : "false"
  const { isScaleQuestion, scaleLevels, isScaleLevelsLoading } = scaleQuestion
  const scoreWithKey = (status: ScoringStatus) => {
    if (cursorExamStudentId === null) return
    if (
      isScaleQuestion &&
      !isStatusCompatibleWithScoringMethod("scale", status)
    ) {
      toast.info(POINT_VERDICT_ON_SCALE_NOTICE, { id: "scale-point-verdict" })
      return
    }
    // 類型方式の設問の保留は点を持たない（点は類型の点数から読む）
    const keepsScore =
      !isScaleQuestion && (status === "partial" || status === "pending")
    onScore({
      status,
      partialScore: keepsScore ? (cursorScore?.partialScore ?? null) : null,
      scaleLevelId: null,
    })
  }
  /** 焦点のある答案にその類型を付ける（下書き） */
  const scoreWithScaleLevel = (scaleLevelId: string) => {
    if (cursorExamStudentId === null) return
    onScore({ status: "evaluated", partialScore: null, scaleLevelId })
  }
  /** 類型方式の設問の数字キー: 並び順の類型を付ける（0・小数点・類型の数を超える数字は何もしない） */
  const scoreWithDigit = (key: string) => {
    if (scaleLevels.length === 0) {
      if (!isScaleLevelsLoading) {
        toast.warning(SCALE_NOT_SELECTED_NOTICE, { id: "scale-not-selected" })
      }
      return
    }
    const scaleLevel = scaleLevelOfDigit(scaleLevels, key)
    if (scaleLevel) scoreWithScaleLevel(scaleLevel.id)
  }

  useSceneCommand("choice.prevAnswer", () => onMove(-1), {
    condition,
    metadata: { title: "前の答案へ（自分で採点）", category: "選択の場面" },
  })
  useSceneCommand("choice.nextAnswer", () => onMove(1), {
    condition,
    metadata: { title: "次の答案へ（自分で採点）", category: "選択の場面" },
  })
  useStatusScoringCommands(scoreWithKey, (title) => ({
    condition,
    metadata: { title: `${title}（問いかけの下書き）`, category: "AI採点" },
  }))

  const selectedAnswers = useMemo(
    () => new Set(cursorExamStudentId === null ? [] : [cursorExamStudentId]),
    [cursorExamStudentId]
  )
  const partialScore = usePartialScore({
    selectedAnswers,
    currentCropRegion: cropRegion,
    onBatchScore: (status, score) => {
      if (cursorExamStudentId === null) return
      onScore({
        status,
        partialScore:
          status === "partial" || status === "pending"
            ? (score ?? cursorScore?.partialScore ?? null)
            : null,
        scaleLevelId: null,
      })
    },
  })
  // 類型方式の設問では、数字キーは部分点の入力を始めず類型を選ぶ
  useChoiceScenePartialStartCommands(
    isScaleQuestion ? scoreWithDigit : partialScore.handlePartialScoreInput,
    condition
  )
  usePartialScoreShortcuts(
    {
      handlePartialScoreInput: partialScore.handlePartialScoreInput,
      handlePartialScoreConfirmPartial: () =>
        partialScore.handlePartialScoreConfirm("partial"),
      handlePartialScoreConfirmPending: () =>
        partialScore.handlePartialScoreConfirm("pending"),
      handlePartialScoreCancel: partialScore.handlePartialScoreCancel,
      handlePartialScoreBackspace: partialScore.handlePartialScoreBackspace,
    },
    { openCondition: "false", inputCondition: MANUAL_CONDITION }
  )
  return {
    partialScore,
    /** 焦点のある答案に点を付ける（採点キー・採点ボタン。下書き） */
    scoreCursor: scoreWithKey,
    /** 焦点のある答案に類型を付ける（類型のボタン。下書き） */
    scoreCursorWithScaleLevel: scoreWithScaleLevel,
  }
}
