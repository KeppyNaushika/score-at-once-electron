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
  /**
   * 選んでいる答案へ書き込み、「いま採点した」印を付けてから次の答案・設問へ進む。
   * 採点キーの書き込み（`handleBatchScore`）と類型の書き込みが同じ進み方をするよう、
   * 書き込みそのものだけを受け取る
   */
  const applyWithProgress = useCallback(
    (write: (answerIds: Set<string>) => void) => {
      // 最近採点した答案を記録（先に実行）
      const answerIds = Array.from(selectedAnswers)
      setRecentlyScoredAnswers((prev) => {
        const newSet = new Set(prev)
        answerIds.forEach((answerId) => newSet.add(answerId))
        return newSet
      })

      // その後で採点実行（楽観的UI更新のため同期的に完了）
      write(selectedAnswers)

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
    },
    [
      selectedAnswers,
      gradingMode,
      scoringBehavior,
      setRecentlyScoredAnswers,
      getGridAnswerData,
      setSelectedAnswers,
      handleNextStudent,
      handleNextQuestion,
    ]
  )

  // 自動進行機能付きのhandleBatchScore（ラッパー）
  const handleBatchScoreWithProgress = useCallback(
    (
      statusOrAnswerIds: ScoringStatus | string | string[],
      statusOrPartialScore?: ScoringStatus | number | null,
      partialScore?: number | null
    ) => {
      applyWithProgress((answerIds) =>
        handleBatchScore(
          statusOrAnswerIds,
          statusOrPartialScore,
          partialScore,
          answerIds
        )
      )
    },
    [applyWithProgress, handleBatchScore]
  )

  return {
    applyWithProgress,
    handleBatchScoreWithProgress,
  }
}
