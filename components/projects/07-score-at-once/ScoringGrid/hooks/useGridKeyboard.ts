import { SCORE_STATUS_CONFIG } from "@/components/projects/07-score-at-once/ScoringGrid/constants/score-status-config"
import type { ScoringStatus } from "@/components/projects/07-score-at-once/types"
import { useEffect } from "react"

interface UseGridKeyboardProps {
  selectedAnswers: Set<string>
  onAnswerScore: (id: string | string[], status: ScoringStatus) => void
}

export function useGridKeyboard({
  selectedAnswers,
  onAnswerScore,
}: UseGridKeyboardProps) {
  // キーボードショートカット処理
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合はスキップ
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const key = event.key.toLowerCase()
      const statusEntry = Object.entries(SCORE_STATUS_CONFIG).find(
        ([_, config]) => config.key === key,
      )

      if (statusEntry && selectedAnswers.size > 0) {
        event.preventDefault()
        const [status] = statusEntry
        onAnswerScore(Array.from(selectedAnswers), status as ScoringStatus)
      }
    }

    document.addEventListener("keydown", handleKeyPress)
    return () => document.removeEventListener("keydown", handleKeyPress)
  }, [selectedAnswers, onAnswerScore])
}
