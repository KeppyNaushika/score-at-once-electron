import { useCallback, useEffect } from "react"
import { toast } from "sonner"
import type { GradingMode } from "../GradingModeToggle"

// 採点状態の型定義
export type ScoringStatus =
  | "ungraded"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

// キーボードショートカットの設定（Python版互換）
export const DEFAULT_SHORTCUTS = {
  ungraded: "q", // 未採点
  correct: "e", // 正答
  partial: "f", // 部分点
  pending: "j", // 保留
  incorrect: "o", // 誤答
  no_answer: "p", // 無答
  nextQuestion: "ArrowRight",
  prevQuestion: "ArrowLeft",
  nextStudent: "ArrowDown",
  prevStudent: "ArrowUp",
  save: "ctrl+s",
  zoomIn: "=",
  zoomOut: "-",
  resetZoom: "0",
  fullView: "f",
}

// macOS detection utility
export const isMacOS = () => {
  if (typeof window !== 'undefined') {
    return window.navigator.platform.toUpperCase().indexOf('MAC') >= 0
  }
  return false
}

// Get the appropriate modifier key label for the current platform
export const getModifierKeyLabel = () => {
  return isMacOS() ? 'Option' : 'Alt'
}

interface UseScoringKeyboardProps {
  gradingMode: GradingMode
  selectedAnswers: Set<string>
  currentStudentIndex: number
  currentQuestionIndex: number
  answerSheetsLength: number
  questionRegionsLength: number
  onBatchScore: (status: ScoringStatus) => void
  onSetScore: (status: ScoringStatus) => void
  onNextQuestion: () => void
  onPrevQuestion: () => void
  onNextStudent: () => void
  onPrevStudent: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  onToggleViewMode: () => void
  onGridNavigation: (direction: string) => void
  onToggleFilterByScoreKey: (key: string) => void
  onRefreshFilter: () => void
  onPartialScoreInput: (key: string) => void
  onPartialScoreReset: () => void
  onToggleFilter: (key: string) => void
}

export function useScoringKeyboard({
  gradingMode,
  selectedAnswers,
  currentStudentIndex,
  currentQuestionIndex,
  answerSheetsLength,
  questionRegionsLength,
  onBatchScore,
  onSetScore,
  onNextQuestion,
  onPrevQuestion,
  onNextStudent,
  onPrevStudent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleViewMode,
  onGridNavigation,
  onToggleFilterByScoreKey,
  onRefreshFilter,
  onPartialScoreInput,
  onPartialScoreReset,
  onToggleFilter,
}: UseScoringKeyboardProps) {
  
  // キーボードイベントハンドラー
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      // 入力フィールドがフォーカスされている場合はスキップ
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // グリッドモードでの特殊キーハンドリング
      if (gradingMode === "grid") {
        const key = event.key.toLowerCase()

        // Alt+採点キーでフィルタ切り替え (macOSではOption+採点キー、WindowsではAlt+採点キー)
        if (
          event.altKey &&
          [
            DEFAULT_SHORTCUTS.ungraded,
            DEFAULT_SHORTCUTS.correct,
            DEFAULT_SHORTCUTS.incorrect,
            DEFAULT_SHORTCUTS.partial,
            DEFAULT_SHORTCUTS.pending,
            DEFAULT_SHORTCUTS.no_answer,
          ].includes(key)
        ) {
          event.preventDefault()
          onToggleFilterByScoreKey(key)
          return
        }

        // WASD移動の処理
        if (["w", "a", "s", "d"].includes(key)) {
          event.preventDefault()
          onGridNavigation(key)
          return
        }

        // Rキーでフィルタを更新（Ctrl+Rは除外してページリロードを許可）
        if (key === "r" && !event.ctrlKey && !event.metaKey) {
          event.preventDefault()
          onRefreshFilter()
          return
        }

        // 数字キーで部分点入力（選択されている答案がある場合）
        if (
          ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(key) &&
          selectedAnswers.size > 0
        ) {
          event.preventDefault()
          onPartialScoreInput(key)
          return
        }

        // Backspaceで部分点をnullに設定
        if (key === "backspace" && selectedAnswers.size > 0) {
          event.preventDefault()
          onPartialScoreReset()
          return
        }

        // 採点キー（Alt無し）で通常の採点
        if (
          [
            DEFAULT_SHORTCUTS.ungraded,
            DEFAULT_SHORTCUTS.correct,
            DEFAULT_SHORTCUTS.incorrect,
            DEFAULT_SHORTCUTS.partial,
            DEFAULT_SHORTCUTS.pending,
            DEFAULT_SHORTCUTS.no_answer,
          ].includes(key) &&
          selectedAnswers.size > 0
        ) {
          event.preventDefault()
          onBatchScore(key as ScoringStatus)
          return
        }

        // 数字キー (1-6) でフィルタ切り替え
        if (["1", "2", "3", "4", "5", "6"].includes(key)) {
          event.preventDefault()
          onToggleFilter(key)
          return
        }

        // グリッドモードではその他のキーはグリッドコンポーネントに委譲
        return
      }

      // 個別採点モードのキーボード処理
      const key = event.key.toLowerCase()
      switch (key) {
        case DEFAULT_SHORTCUTS.ungraded:
          event.preventDefault()
          onSetScore("ungraded")
          break
        case DEFAULT_SHORTCUTS.correct:
          event.preventDefault()
          onSetScore("correct")
          break
        case DEFAULT_SHORTCUTS.partial:
          event.preventDefault()
          onSetScore("partial")
          break
        case DEFAULT_SHORTCUTS.pending:
          event.preventDefault()
          onSetScore("pending")
          break
        case DEFAULT_SHORTCUTS.incorrect:
          event.preventDefault()
          onSetScore("incorrect")
          break
        case DEFAULT_SHORTCUTS.no_answer:
          event.preventDefault()
          onSetScore("no_answer")
          break
        case "ArrowRight":
          event.preventDefault()
          onNextQuestion()
          break
        case "ArrowLeft":
          event.preventDefault()
          onPrevQuestion()
          break
        case "ArrowDown":
          event.preventDefault()
          onNextStudent()
          break
        case "ArrowUp":
          event.preventDefault()
          onPrevStudent()
          break
        case DEFAULT_SHORTCUTS.zoomIn:
          event.preventDefault()
          onZoomIn()
          break
        case DEFAULT_SHORTCUTS.zoomOut:
          event.preventDefault()
          onZoomOut()
          break
        case DEFAULT_SHORTCUTS.resetZoom:
          event.preventDefault()
          onResetZoom()
          break
        case DEFAULT_SHORTCUTS.fullView:
          event.preventDefault()
          onToggleViewMode()
          break
      }
    },
    [
      gradingMode,
      selectedAnswers,
      currentStudentIndex,
      currentQuestionIndex,
      answerSheetsLength,
      questionRegionsLength,
      onBatchScore,
      onSetScore,
      onNextQuestion,
      onPrevQuestion,
      onNextStudent,
      onPrevStudent,
      onZoomIn,
      onZoomOut,
      onResetZoom,
      onToggleViewMode,
      onGridNavigation,
      onToggleFilterByScoreKey,
      onRefreshFilter,
      onPartialScoreInput,
      onPartialScoreReset,
      onToggleFilter,
    ],
  )

  // キーボードイベントリスナーの設定
  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress)
    return () => document.removeEventListener("keydown", handleKeyPress)
  }, [handleKeyPress])

  return {
    handleKeyPress,
  }
}