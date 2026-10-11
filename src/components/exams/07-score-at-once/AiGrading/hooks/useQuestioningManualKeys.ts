/**
 * 問いかけの「1件ずつ自分で採点する」のキー（docs/vlm-grading-design.md §3-5・§11-4）。
 *
 * カードの答案を ←→ で移り、いつもの採点キー（英字の採点状態・数字で部分点の入力欄）で、
 * 焦点のある答案に点を付ける。**付けた点は下書き**で（ここでは書かない）、問いの答えとして残し、
 * 見直しの「確定する」で入る。問いかけの外（普段の採点の画面）の採点キーはその場で確定のまま。
 *
 * 部分点の入力欄は一覧表示と同じもの（`usePartialScore`）を、焦点のある答案1件を選んだものとして使う。
 * 入力欄の中のキーは、AI採点モードの「自分で採点」の登録より具体的な条件で先に効かせる。
 */

import { useMemo } from "react"

import { useSceneCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { usePartialScoreShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/usePartialScoreShortcuts"
import { usePartialScore } from "@/components/exams/07-score-at-once/ScoringMain/hooks/usePartialScore"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import type { QuestioningScore } from "../utils/questioningSteps"
import { AI_GRADING_MODE_CONDITION } from "./useAiGradingShortcuts"
import {
  useChoiceScenePartialStartCommands,
  useStatusScoringCommands,
} from "./useAiScoringKeyCommands"

interface UseQuestioningManualKeysOptions {
  /** 1件ずつ採点している最中か（キーを効かせるか） */
  isActive: boolean
  cropRegion: QuestionAnswerRegionRow
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
  cursorExamStudentId,
  cursorScore,
  onMove,
  onScore,
}: UseQuestioningManualKeysOptions) {
  useContextValue("aiQuestioningManual", isActive)
  const condition = isActive ? MANUAL_CONDITION : "false"
  const scoreWithKey = (status: ScoringStatus) => {
    if (cursorExamStudentId === null) return
    const keepsScore = status === "partial" || status === "pending"
    onScore({
      status,
      partialScore: keepsScore ? (cursorScore?.partialScore ?? null) : null,
    })
  }

  useSceneCommand("choice.prevAnswer", () => onMove(-1), {
    condition,
    metadata: { title: "前の答案へ（1件ずつ採点）", category: "選択の場面" },
  })
  useSceneCommand("choice.nextAnswer", () => onMove(1), {
    condition,
    metadata: { title: "次の答案へ（1件ずつ採点）", category: "選択の場面" },
  })
  useStatusScoringCommands(scoreWithKey, "choice", (title) => ({
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
      })
    },
  })
  useChoiceScenePartialStartCommands(
    partialScore.handlePartialScoreInput,
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
  return partialScore
}
