import { useCallback } from "react"
import type { GradingMode } from "@/components/projects/07-score-at-once/components/GradingModeToggle"

interface UseBatchScoringWithProgressParams {
  selectedAnswers: Set<string>
  gradingMode: GradingMode
  setRecentlyScoredAnswers: (callback: (prev: Set<string>) => Set<string>) => void
  handleBatchScore: (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
    selectedAnswers?: Set<string>
  ) => Promise<void>
  getGridAnswerData: () => any[]
  setSelectedAnswers: (answers: Set<string>) => void
  handleGridNavigation: (direction: string) => void
  handleNextStudent: () => void
}

export function useBatchScoringWithProgress({
  selectedAnswers,
  gradingMode,
  setRecentlyScoredAnswers,
  handleBatchScore,
  getGridAnswerData,
  setSelectedAnswers,
  handleGridNavigation,
  handleNextStudent,
}: UseBatchScoringWithProgressParams) {
  // 自動進行機能付きのhandleBatchScore（ラッパー）
  const handleBatchScoreWithProgress = useCallback(
    async (
      statusOrAnswerIds: any,
      statusOrPartialScore?: any,
      partialScore?: any,
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
        selectedAnswers,
      )

      // 採点後の自動次答案選択（一覧採点モード用）
      if (gradingMode === "grid" && selectedAnswers.size >= 1) {
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
      } else {
        // 選択をクリアせず保持する
      }

      // 採点実行完了
    },
    [
      selectedAnswers,
      gradingMode,
      setRecentlyScoredAnswers,
      handleBatchScore,
      getGridAnswerData,
      setSelectedAnswers,
    ],
  )

  // 自動進行関数
  const handleAutoAdvance = useCallback(() => {
    if (gradingMode === "grid") {
      // グリッドモードでは次の答案に移動
      handleGridNavigation("d")
    } else {
      // 個別モードでは次の学生に移動
      handleNextStudent()
    }
  }, [gradingMode, handleGridNavigation, handleNextStudent])

  return {
    handleBatchScoreWithProgress,
    handleAutoAdvance,
  }
}