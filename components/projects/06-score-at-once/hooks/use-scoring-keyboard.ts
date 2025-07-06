import { useCallback, useEffect } from "react"
import { toast } from "sonner"
import type { GradingMode } from "../GradingModeToggle"
import type { ScoringStatus } from "../types"

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
  // WASD移動
  moveUp: "w",
  moveLeft: "a", 
  moveDown: "s",
  moveRight: "d",
  // その他
  refreshFilter: "r",
  toggleNames: "n",
}

// localStorageからキーボードショートカットを読み込む
export const getKeyboardShortcuts = () => {
  if (typeof window === 'undefined') return DEFAULT_SHORTCUTS
  
  try {
    const stored = localStorage.getItem('keyboard-shortcuts')
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_SHORTCUTS, ...parsed }
    }
  } catch (error) {
    console.warn('Failed to load keyboard shortcuts from localStorage:', error)
  }
  
  return DEFAULT_SHORTCUTS
}

// キーボードショートカットをlocalStorageに保存
export const saveKeyboardShortcuts = (shortcuts: typeof DEFAULT_SHORTCUTS) => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('keyboard-shortcuts', JSON.stringify(shortcuts))
  } catch (error) {
    console.error('Failed to save keyboard shortcuts to localStorage:', error)
  }
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
  onPartialScoreConfirm: (confirmType: "partial" | "pending") => void
  onPartialScoreCancel: () => void
  onPartialScoreBackspace: () => void
  showPartialScoreModal: boolean
  onToggleFilter: (key: string) => void
  onToggleStudentNames?: () => void
}

// macOSデッドキーのKeyCodeマッピング
const DEAD_KEY_CODE_MAP: { [code: string]: string } = {
  KeyQ: "q",
  KeyE: "e", 
  KeyF: "f",
  KeyJ: "j",
  KeyO: "o",
  KeyP: "p",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  KeyW: "w",
  KeyR: "r",
  KeyT: "t",
  KeyY: "y",
  KeyU: "u",
  KeyI: "i",
  KeyG: "g",
  KeyH: "h",
  KeyK: "k",
  KeyL: "l",
  KeyZ: "z",
  KeyX: "x",
  KeyC: "c",
  KeyV: "v",
  KeyB: "b",
  KeyN: "n",
  KeyM: "m",
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
  onPartialScoreConfirm,
  onPartialScoreCancel,
  onPartialScoreBackspace,
  showPartialScoreModal,
  onToggleFilter,
  onToggleStudentNames,
}: UseScoringKeyboardProps) {
  
  // キーボードイベントハンドラー
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      // 動的にショートカットを取得（リアルタイム反映のため）
      const shortcuts = getKeyboardShortcuts()
      
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

        // 部分点入力モーダルが開いている場合の処理
        if (showPartialScoreModal) {
          // F/Jキーで確定
          if (key === "f") {
            event.preventDefault()
            onPartialScoreConfirm("partial")
            return
          }
          if (key === "j") {
            event.preventDefault()
            onPartialScoreConfirm("pending")
            return
          }
          // Escapeでキャンセル
          if (key === "escape") {
            event.preventDefault()
            onPartialScoreCancel()
            return
          }
          // Backspaceで文字削除
          if (key === "backspace") {
            event.preventDefault()
            onPartialScoreBackspace()
            return
          }
          // 数字・小数点入力
          if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."].includes(key)) {
            event.preventDefault()
            onPartialScoreInput(key)
            return
          }
          // モーダル中はその他のキーを無視
          event.preventDefault()
          return
        }

        // Alt+採点キーでフィルタ切り替え (macOSではOption+採点キー、WindowsではAlt+採点キー)
        // macOSのデッドキー対応: Option+Eは"Dead"として検知されるため、event.codeを使用
        if (event.altKey) {
          let targetKey = key
          
          // macOSのデッドキー対応
          if (key === "dead" && event.code && DEAD_KEY_CODE_MAP[event.code]) {
            targetKey = DEAD_KEY_CODE_MAP[event.code]
          }
          
          if ([
            shortcuts.ungraded,
            shortcuts.correct,
            shortcuts.incorrect,
            shortcuts.partial,
            shortcuts.pending,
            shortcuts.no_answer,
          ].includes(targetKey)) {
            event.preventDefault()
            onToggleFilterByScoreKey(targetKey)
            return
          }
        }

        // WASD移動の処理
        if ([shortcuts.moveUp, shortcuts.moveLeft, shortcuts.moveDown, shortcuts.moveRight].includes(key)) {
          event.preventDefault()
          // キーを対応する方向に変換
          let direction = key
          if (key === shortcuts.moveUp) direction = "w"
          else if (key === shortcuts.moveLeft) direction = "a"
          else if (key === shortcuts.moveDown) direction = "s"
          else if (key === shortcuts.moveRight) direction = "d"
          onGridNavigation(direction)
          return
        }

        // Rキーでフィルタを更新（Ctrl+Rは除外してページリロードを許可）
        if (key === shortcuts.refreshFilter && !event.ctrlKey && !event.metaKey) {
          event.preventDefault()
          onRefreshFilter()
          return
        }

        // Nキーで生徒名表示切り替え
        if (key === shortcuts.toggleNames && onToggleStudentNames) {
          event.preventDefault()
          onToggleStudentNames()
          return
        }

        // 数字キー・小数点・Backspaceで部分点入力（選択されている答案がある場合）
        if (
          ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."].includes(key) &&
          selectedAnswers.size > 0
        ) {
          event.preventDefault()
          onPartialScoreInput(key)
          return
        }


        // 採点キー（Alt無し）で通常の採点
        if (
          [
            shortcuts.ungraded,
            shortcuts.correct,
            shortcuts.incorrect,
            shortcuts.partial,
            shortcuts.pending,
            shortcuts.no_answer,
          ].includes(key) &&
          selectedAnswers.size > 0
        ) {
          event.preventDefault()
          onBatchScore(key as ScoringStatus)
          return
        }

        // Ctrl+数字キー (1-6) でフィルタ切り替え（部分点入力と競合回避）
        if (["1", "2", "3", "4", "5", "6"].includes(key) && event.ctrlKey) {
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
        case shortcuts.ungraded:
          event.preventDefault()
          onSetScore("ungraded")
          break
        case shortcuts.correct:
          event.preventDefault()
          onSetScore("correct")
          break
        case shortcuts.partial:
          event.preventDefault()
          onSetScore("partial")
          break
        case shortcuts.pending:
          event.preventDefault()
          onSetScore("pending")
          break
        case shortcuts.incorrect:
          event.preventDefault()
          onSetScore("incorrect")
          break
        case shortcuts.no_answer:
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
        case shortcuts.zoomIn:
          event.preventDefault()
          onZoomIn()
          break
        case shortcuts.zoomOut:
          event.preventDefault()
          onZoomOut()
          break
        case shortcuts.resetZoom:
          event.preventDefault()
          onResetZoom()
          break
        case shortcuts.fullView:
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
      onPartialScoreConfirm,
      onPartialScoreCancel,
      onPartialScoreBackspace,
      showPartialScoreModal,
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