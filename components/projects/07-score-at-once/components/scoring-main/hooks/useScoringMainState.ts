import { useState, useEffect, useCallback } from "react"
import type { GradingMode } from "@/components/projects/07-score-at-once/components/GradingModeToggle"
import { getModifierKeyLabel } from "@/components/projects/07-score-at-once/hooks/useScoringKeyboard"
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_LAYOUT_DIRECTION,
  DEFAULT_EFFECTIVE_COLUMNS,
} from "@/components/projects/07-score-at-once/components/scoring-main/constants/keyboard-shortcuts"
import type {
  LayoutDirection,
  GridSize,
  ScoringMainViewState,
  ScoringMainViewActions,
} from "@/components/projects/07-score-at-once/components/scoring-main/types/scoring-main-types"

export function useScoringMainState() {
  // 採点モード状態
  const [gradingMode, setGradingMode] = useState<GradingMode>("grid")
  const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set())
  const [gridSize, _setGridSize] = useState<GridSize>(DEFAULT_GRID_SIZE)
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>(DEFAULT_LAYOUT_DIRECTION)
  const [effectiveColumns, setEffectiveColumns] = useState<number>(DEFAULT_EFFECTIVE_COLUMNS)
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

  const state: ScoringMainViewState = {
    gradingMode,
    selectedAnswers,
    gridSize,
    layoutDirection,
    effectiveColumns,
    currentStudentIndex,
    currentQuestionIndex,
    showKeyboardHelp,
    showScoreComparison,
    showSidePanel,
    modifierKeyLabel,
  }

  const actions: ScoringMainViewActions = {
    setGradingMode,
    setSelectedAnswers,
    setLayoutDirection,
    setEffectiveColumns,
    setCurrentStudentIndex,
    setCurrentQuestionIndex,
    setShowKeyboardHelp,
    setShowScoreComparison,
    setShowSidePanel,
    setModifierKeyLabel,
  }

  // グリッドビュー用のヘルパー関数
  const handleAnswerSelect = useCallback((answerId: string, isSelected: boolean, answerSheets: any[]) => {
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
  }, [])

  return {
    state,
    actions,
    gridSize,
    handleAnswerSelect,
  }
}