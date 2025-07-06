import { useState, useCallback } from "react"
import { ScoringStatus } from "./use-scoring-keyboard"
import { QuestionRegion } from "./use-scoring-data"

interface UsePartialScoreProps {
  selectedAnswers: Set<string>
  currentQuestion: QuestionRegion | undefined
  onBatchScore: (status: ScoringStatus, score?: number | null) => void
}

export function usePartialScore({
  selectedAnswers,
  currentQuestion,
  onBatchScore,
}: UsePartialScoreProps) {
  // 部分点入力用状態
  const [partialScoreInput, setPartialScoreInput] = useState("")
  const [partialScoreInputTimer, setPartialScoreInputTimer] = useState<NodeJS.Timeout | null>(null)

  // 部分点入力処理
  const handlePartialScoreInput = useCallback(async (digit: string) => {
    if (selectedAnswers.size === 0 || !currentQuestion) return

    // 現在の部分点入力状態を管理
    const currentPartialInput = partialScoreInput || ""
    const newPartialInput = currentPartialInput + digit

    // 数値として有効かチェック（最大点数以下）
    const numericValue = parseFloat(newPartialInput)
    const maxPoints = currentQuestion.points || 10
    if (isNaN(numericValue) || numericValue > maxPoints) {
      return // 無効な入力は無視
    }

    setPartialScoreInput(newPartialInput)

    // 一定時間後に自動的に採点を実行
    if (partialScoreInputTimer) {
      clearTimeout(partialScoreInputTimer)
    }

    const timer = setTimeout(() => {
      if (partialScoreInput === newPartialInput) {
        // 入力が変更されていない場合のみ
        onBatchScore("partial", numericValue)
        setPartialScoreInput("")
      }
    }, 1500) // 1.5秒待機

    setPartialScoreInputTimer(timer)
  }, [
    selectedAnswers.size,
    currentQuestion,
    partialScoreInput,
    partialScoreInputTimer,
    onBatchScore,
  ])

  // 部分点リセット処理
  const handlePartialScoreReset = useCallback(() => {
    if (selectedAnswers.size === 0) return

    setPartialScoreInput("")
    if (partialScoreInputTimer) {
      clearTimeout(partialScoreInputTimer)
      setPartialScoreInputTimer(null)
    }
    onBatchScore("partial", null)
  }, [selectedAnswers.size, partialScoreInputTimer, onBatchScore])

  return {
    partialScoreInput,
    setPartialScoreInput,
    handlePartialScoreInput,
    handlePartialScoreReset,
  }
}