import { useCallback } from "react"
import { toast } from "sonner"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import type { ScaleQuestionState } from "@/components/exams/07-score-at-once/ScaleLevel/hooks/useScaleScoringGate"
import {
  POINT_VERDICT_ON_SCALE_NOTICE,
  SCALE_NOT_SELECTED_NOTICE,
} from "@/components/exams/07-score-at-once/ScaleLevel/scaleLevelMessages"
import { scaleLevelOfDigit } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import { usePartialScore } from "@/components/exams/07-score-at-once/ScoringMain/hooks/usePartialScore"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import type { DecisionVerdict } from "../types"

interface UseDecisionKeysOptions {
  selectedIds: Set<string>
  currentCropRegion: QuestionAnswerRegionRow | null
  scaleQuestion: ScaleQuestionState
  decide: (verdict: DecisionVerdict, score?: number | null) => void
  decideScaleLevel: (scaleLevelId: string) => void
}

/**
 * 部分点・保留・数字キーの入口と、キー操作の文脈（07 と同じ ShortcutProvider の上で動く）。
 * 部分点・保留は 07 と同じ入力欄で点を入れ、類型評価の設問では数字キーで類型を選ぶ
 */
export function useDecisionKeys({
  selectedIds,
  currentCropRegion,
  scaleQuestion,
  decide,
  decideScaleLevel,
}: UseDecisionKeysOptions) {
  const { isScaleQuestion, scaleLevels, isScaleLevelsLoading } = scaleQuestion

  // 部分点・保留は 07 と同じ入力欄で点を入れる
  const partialScore = usePartialScore({
    selectedAnswers: selectedIds,
    currentCropRegion,
    onBatchScore: (status, score) => {
      if (status === "unscored") return
      decide(status, score ?? null)
    },
  })

  /** 部分点の欄を開く（部分点のキー・ボタン）。類型評価の設問は部分点を持たないので開かない */
  const openPartialScoreModal = useCallback(() => {
    if (isScaleQuestion) {
      toast.info(POINT_VERDICT_ON_SCALE_NOTICE, { id: "scale-point-verdict" })
      return
    }
    partialScore.openPartialScoreModal()
  }, [isScaleQuestion, partialScore])

  /** 保留（キー・ボタン）。点の採点の設問は点を入れる欄を開き、類型評価の設問はそのまま確定する */
  const openPendingInput = useCallback(() => {
    if (isScaleQuestion) {
      decide("pending")
      return
    }
    partialScore.openPartialScoreModal()
  }, [isScaleQuestion, decide, partialScore])

  /**
   * 数字キー。類型評価の設問では並び順に類型を選んで確定し（1 が先頭）、ほかの設問では
   * 部分点の入力を始める（07 と同じ）。組が無ければ知らせ、類型の数を超える数字は何もしない
   */
  const handleDigitKey = useCallback(
    (key: string) => {
      if (!isScaleQuestion) {
        partialScore.handlePartialScoreInput(key)
        return
      }
      if (scaleLevels.length === 0) {
        if (!isScaleLevelsLoading) {
          toast.warning(SCALE_NOT_SELECTED_NOTICE, { id: "scale-not-selected" })
        }
        return
      }
      const scaleLevel = scaleLevelOfDigit(scaleLevels, key)
      if (scaleLevel) decideScaleLevel(scaleLevel.id)
    },
    [
      isScaleQuestion,
      partialScore,
      scaleLevels,
      isScaleLevelsLoading,
      decideScaleLevel,
    ]
  )

  // キー操作の文脈（07 と同じ ShortcutProvider の上で動く）
  useContextValue("hasSelectedAnswers", selectedIds.size > 0)
  useContextValue("partialScoreModalOpen", partialScore.showPartialScoreModal)
  useContextValue("modalOpen", partialScore.showPartialScoreModal)

  return {
    partialScore,
    openPartialScoreModal,
    openPendingInput,
    handleDigitKey,
  }
}
