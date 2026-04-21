/**
 * 採点操作モード管理フック
 * キーボード/マウスモードの切替とlocalStorage永続化を提供
 */

import { useCallback, useState } from "react"

import type {
  MouseBrushAction,
  ScoringOperationMode,
} from "@/components/exams/07-score-at-once/types"

const STORAGE_KEY_MODE = "scoring-operation-mode"
const STORAGE_KEY_REMEMBER = "scoring-operation-mode-remember"

interface UseScoringModeReturn {
  /** 現在の操作モード */
  scoringOperationMode: ScoringOperationMode
  /** モード選択モーダルを表示するか */
  showModeSelectionModal: boolean
  /** モーダルからモードを選択 */
  selectMode: (mode: ScoringOperationMode, remember: boolean) => void
  /** モードを直接設定（トグル用） */
  setScoringOperationMode: (mode: ScoringOperationMode) => void
  /** モーダルを閉じる */
  closeModeSelectionModal: () => void
  /** モーダルを開く */
  openModeSelectionModal: () => void
  /** 現在のマウスブラシ */
  mouseBrush: MouseBrushAction
  /** マウスブラシを設定 */
  setMouseBrush: (brush: MouseBrushAction) => void
}

export function useScoringMode(): UseScoringModeReturn {
  // localStorageから記憶済みモードを取得
  const remembered = (() => {
    try {
      const shouldRemember = localStorage.getItem(STORAGE_KEY_REMEMBER)
      if (shouldRemember === "true") {
        const mode = localStorage.getItem(STORAGE_KEY_MODE)
        if (mode === "keyboard" || mode === "mouse") {
          return mode
        }
      }
    } catch {
      // localStorage利用不可の場合は無視
    }
    return null
  })()

  const [scoringOperationMode, setModeInternal] =
    useState<ScoringOperationMode>(remembered ?? "keyboard")
  const [showModeSelectionModal, setShowModeSelectionModal] =
    useState(!remembered)
  const [mouseBrush, setMouseBrush] = useState<MouseBrushAction>("correct")

  const selectMode = useCallback(
    (mode: ScoringOperationMode, remember: boolean) => {
      setModeInternal(mode)
      setShowModeSelectionModal(false)
      try {
        if (remember) {
          localStorage.setItem(STORAGE_KEY_MODE, mode)
          localStorage.setItem(STORAGE_KEY_REMEMBER, "true")
        } else {
          localStorage.removeItem(STORAGE_KEY_MODE)
          localStorage.removeItem(STORAGE_KEY_REMEMBER)
        }
      } catch {
        // localStorage利用不可の場合は無視
      }
    },
    []
  )

  const setScoringOperationMode = useCallback((mode: ScoringOperationMode) => {
    setModeInternal(mode)
    try {
      const shouldRemember = localStorage.getItem(STORAGE_KEY_REMEMBER)
      if (shouldRemember === "true") {
        localStorage.setItem(STORAGE_KEY_MODE, mode)
      }
    } catch {
      // localStorage利用不可の場合は無視
    }
  }, [])

  const closeModeSelectionModal = useCallback(() => {
    setShowModeSelectionModal(false)
  }, [])

  const openModeSelectionModal = useCallback(() => {
    setShowModeSelectionModal(true)
  }, [])

  return {
    scoringOperationMode,
    showModeSelectionModal,
    selectMode,
    setScoringOperationMode,
    closeModeSelectionModal,
    openModeSelectionModal,
    mouseBrush,
    setMouseBrush,
  }
}
