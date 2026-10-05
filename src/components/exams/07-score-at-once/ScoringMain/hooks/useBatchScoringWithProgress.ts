import { useCallback } from "react"

import type {
  GradingMode,
  ScoringBehavior,
  ScoringData,
} from "@/components/exams/07-score-at-once/types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { findNextAnswerIdAfterScoring } from "../utils/nextAnswerAfterScoring"

/** ScoringDataに選択状態を追加した型 */
type ScoringDataWithSelection = ScoringData & { isSelected: boolean }

interface UseBatchScoringWithProgressParams {
  selectedAnswers: Set<string>
  gradingMode: GradingMode
  scoringBehavior: ScoringBehavior
  setRecentlyScoredAnswers: (
    callback: (prev: Set<string>) => Set<string>
  ) => void
  handleBatchScore: (
    statusOrAnswerIds: ScoringStatus | string | string[],
    statusOrPartialScore?: ScoringStatus | number | null,
    partialScore?: number | null,
    selectedAnswers?: Set<string>
  ) => void
  getGridAnswerData: () => ScoringDataWithSelection[]
  setSelectedAnswers: (answers: Set<string>) => void
  handleNextStudent: () => void
  handleNextQuestion: () => void
}

/** 一括採点実行後に次の答案・設問への自動進行を行うラッパーフック */
export function useBatchScoringWithProgress({
  selectedAnswers,
  gradingMode,
  scoringBehavior,
  setRecentlyScoredAnswers,
  handleBatchScore,
  getGridAnswerData,
  setSelectedAnswers,
  handleNextStudent,
  handleNextQuestion,
}: UseBatchScoringWithProgressParams) {
  // 自動進行機能付きのhandleBatchScore（ラッパー）
  const handleBatchScoreWithProgress = useCallback(
    (
      statusOrAnswerIds: ScoringStatus | string | string[],
      statusOrPartialScore?: ScoringStatus | number | null,
      partialScore?: number | null
    ) => {
      // 採点実行開始

      // 最近採点した答案を記録（先に実行）
      const answerIds = Array.from(selectedAnswers)
      setRecentlyScoredAnswers((prev) => {
        const newSet = new Set(prev)
        answerIds.forEach((answerId) => newSet.add(answerId))
        return newSet
      })

      // その後で採点実行（楽観的UI更新のため同期的に完了）
      handleBatchScore(
        statusOrAnswerIds,
        statusOrPartialScore,
        partialScore,
        selectedAnswers
      )

      // 採点後の自動進行
      if (gradingMode === "grid" && selectedAnswers.size >= 1) {
        // グリッドモード: 選んでいた答案のうち最後のものの次を選ぶ（末尾なら選択を残す）。
        // getGridAnswerData はこの描画のもので、書き込む前の並びを返す
        const nextAnswerId = findNextAnswerIdAfterScoring(
          getGridAnswerData().map((answer) => answer.id),
          selectedAnswers
        )
        if (nextAnswerId) {
          setSelectedAnswers(new Set([nextAnswerId]))
        }
      } else if (gradingMode === "individual") {
        // 個別モード: scoringBehaviorに従って自動進行
        if (scoringBehavior === "next-student") {
          // 次の生徒の同じ設問
          handleNextStudent()
        } else {
          // 同じ生徒の次の設問
          handleNextQuestion()
        }
      }

      // 採点実行完了
    },
    [
      selectedAnswers,
      gradingMode,
      scoringBehavior,
      setRecentlyScoredAnswers,
      handleBatchScore,
      getGridAnswerData,
      setSelectedAnswers,
      handleNextStudent,
      handleNextQuestion,
    ]
  )

  return {
    handleBatchScoreWithProgress,
  }
}
