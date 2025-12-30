import type {
  GradingMode,
  ScoringData,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"
import type { ScoringBehavior } from "@/components/projects/07-score-at-once/ScoringIndividual/ScoringBehaviorSelector"
import { useCallback } from "react"

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
  ) => Promise<void>
  getGridAnswerData: () => ScoringDataWithSelection[]
  setSelectedAnswers: (answers: Set<string>) => void
  handleGridNavigation: (direction: string) => void
  handleNextStudent: () => void
  handleNextQuestion: () => void
}

export function useBatchScoringWithProgress({
  selectedAnswers,
  gradingMode,
  scoringBehavior,
  setRecentlyScoredAnswers,
  handleBatchScore,
  getGridAnswerData,
  setSelectedAnswers,
  handleGridNavigation,
  handleNextStudent,
  handleNextQuestion,
}: UseBatchScoringWithProgressParams) {
  // 自動進行機能付きのhandleBatchScore（ラッパー）
  const handleBatchScoreWithProgress = useCallback(
    async (
      statusOrAnswerIds: ScoringStatus | string | string[],
      statusOrPartialScore?: ScoringStatus | number | null,
      partialScore?: number | null
    ) => {
      // 採点実行開始

      // 最近採点した答案を記録（先に実行）
      const answerIds = Array.from(selectedAnswers)
      setRecentlyScoredAnswers((prev) => {
        const newSet = new Set(prev)
        answerIds.forEach((id) => newSet.add(id))
        return newSet
      })

      // その後で採点実行
      await handleBatchScore(
        statusOrAnswerIds,
        statusOrPartialScore,
        partialScore,
        selectedAnswers
      )

      // 採点後の自動進行
      if (gradingMode === "grid" && selectedAnswers.size >= 1) {
        // グリッドモード: 次の答案を自動選択
        const gridAnswers = getGridAnswerData()

        // 最適化: 答案IDのインデックスマップを事前作成
        const answerIndexMap = new Map<string, number>()
        gridAnswers.forEach((answer, index) => {
          answerIndexMap.set(answer.id, index)
        })

        // 複数選択の場合は最終答案（最後にソートされた答案）を基準にする
        let maxIndex = -1
        for (const selectedId of selectedAnswers) {
          const index = answerIndexMap.get(selectedId)
          if (index !== undefined && index > maxIndex) {
            maxIndex = index
          }
        }

        if (maxIndex >= 0 && maxIndex < gridAnswers.length - 1) {
          // 最終答案の次の答案を選択（模範解答をスキップ）
          let nextIndex = maxIndex + 1
          while (
            nextIndex < gridAnswers.length &&
            gridAnswers[nextIndex].id.startsWith("master-")
          ) {
            nextIndex++
          }

          if (nextIndex < gridAnswers.length) {
            const nextAnswerId = gridAnswers[nextIndex].id
            setSelectedAnswers(new Set([nextAnswerId]))
          } else {
            // 選択をクリアせず保持する
          }
        } else {
          // 選択をクリアせず保持する
        }
      } else if (gradingMode === "individual") {
        // 個別モード: scoringBehaviorに従って自動進行
        if (scoringBehavior === "next-student") {
          // 次の生徒の同じ設問
          handleNextStudent()
        } else if (scoringBehavior === "next-question") {
          // 同じ生徒の次の設問
          handleNextQuestion()
        }
        // "stay"の場合は何もしない
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

  // 自動進行関数
  const handleAutoAdvance = useCallback(() => {
    if (gradingMode === "grid") {
      // グリッドモードでは次の答案に移動
      handleGridNavigation("d")
    } else {
      // 個別モードではscoringBehaviorに従って移動
      if (scoringBehavior === "next-student") {
        handleNextStudent()
      } else if (scoringBehavior === "next-question") {
        handleNextQuestion()
      }
      // "stay"の場合は何もしない
    }
  }, [
    gradingMode,
    scoringBehavior,
    handleGridNavigation,
    handleNextStudent,
    handleNextQuestion,
  ])

  return {
    handleBatchScoreWithProgress,
    handleAutoAdvance,
  }
}
