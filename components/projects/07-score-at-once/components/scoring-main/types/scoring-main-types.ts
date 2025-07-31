import type { GradingMode } from "@/components/projects/07-score-at-once/components/GradingModeToggle"

export type { GradingMode }

export type LayoutDirection = "right-down" | "left-down" | "down-right" | "down-left"

export type ViewMode = "question" | "full"

export interface GridSize {
  columns: number
  rows: number
}

export interface ImagePosition {
  x: number
  y: number
}

export interface ScoringMainViewState {
  gradingMode: GradingMode
  selectedAnswers: Set<string>
  gridSize: GridSize
  layoutDirection: LayoutDirection
  effectiveColumns: number
  currentStudentIndex: number
  currentQuestionIndex: number
  showKeyboardHelp: boolean
  showScoreComparison: boolean
  showSidePanel: boolean
  modifierKeyLabel: string
}

export interface ScoringMainViewActions {
  setGradingMode: (mode: GradingMode) => void
  setSelectedAnswers: (answers: Set<string>) => void
  setLayoutDirection: (direction: LayoutDirection) => void
  setEffectiveColumns: (columns: number) => void
  setCurrentStudentIndex: (index: number) => void
  setCurrentQuestionIndex: (index: number) => void
  setShowKeyboardHelp: (show: boolean) => void
  setShowScoreComparison: (show: boolean) => void
  setShowSidePanel: (show: boolean) => void
  setModifierKeyLabel: (label: string) => void
}