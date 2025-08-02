import { useState, useEffect, useCallback } from "react"
import type { GradingMode } from "@/components/projects/07-score-at-once/ScoringMain/components/GradingModeToggle"
import { getModifierKeyLabel } from "@/components/projects/07-score-at-once/hooks/useScoringKeyboard"
import { DEFAULT_LAYOUT_DIRECTION } from "@/components/projects/07-score-at-once/ScoringMain/constants/keyboard-shortcuts"
import type { LayoutDirection } from "@/components/projects/07-score-at-once/ScoringMain/types/scoring-main-types"

export function useScoringMainState() {
  // 採点モード状態
  const [gradingMode, setGradingMode] = useState<GradingMode>("grid")
  const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set())
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>(
    DEFAULT_LAYOUT_DIRECTION,
  )
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showScoreComparison, setShowScoreComparison] = useState(false)
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [modifierKeyLabel, setModifierKeyLabel] = useState("Alt")

  // プラットフォーム固有のキーラベルを初期化
  useEffect(() => {
    setModifierKeyLabel(getModifierKeyLabel())
  }, [])

  // グリッドビュー用のヘルパー関数
  const handleAnswerSelect = useCallback(
    (answerId: string, isSelected: boolean, answerSheets: any[]) => {
      // 模範解答は選択対象外
      if (answerId.startsWith("master-")) {
        return
      }

      // 答案が実際に存在するかチェック
      const answerExists = answerSheets.some((sheet) => sheet.id === answerId)
      if (!answerExists) {
        return
      }

      setSelectedAnswers((prev) => {
        const newSet = new Set(prev)
        if (isSelected) {
          newSet.add(answerId)
        } else {
          newSet.delete(answerId)
        }
        return newSet
      })
    },
    [],
  )

  return {
    // 個別の状態
    gradingMode,
    selectedAnswers,
    layoutDirection,
    currentStudentIndex,
    currentQuestionIndex,
    showKeyboardHelp,
    showScoreComparison,
    showSidePanel,
    modifierKeyLabel,
    // アクション関数
    setGradingMode,
    setSelectedAnswers,
    setLayoutDirection,
    setCurrentStudentIndex,
    setCurrentQuestionIndex,
    setShowKeyboardHelp,
    setShowScoreComparison,
    setShowSidePanel,
    setModifierKeyLabel,
    // ヘルパー関数
    handleAnswerSelect,
  }
}
