import { DEFAULT_LAYOUT_DIRECTION } from "@/components/projects/07-score-at-once/ScoringMain/constants/keyboard-shortcuts"
import { getModifierKeyLabel } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringKeyboard"
import type {
  GradingMode,
  LayoutDirection,
} from "@/components/projects/07-score-at-once/types"
import { useCallback, useState } from "react"

export function useScoringMainState() {
  // 採点モード状態
  const [gradingMode, setGradingMode] = useState<GradingMode>("grid")
  const [selectedPageImageIds, setSelectedPageImageIds] = useState<Set<string>>(
    new Set(),
  )
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>(
    DEFAULT_LAYOUT_DIRECTION,
  )
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [currentCropRegionId, setCurrentCropRegionId] = useState<string | null>(
    null,
  )
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showScoreComparison, setShowScoreComparison] = useState(false)
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [modifierKeyLabel, setModifierKeyLabel] = useState(
    () => getModifierKeyLabel() || "Alt",
  )

  // グリッドビュー用のヘルパー関数
  const handleAnswerSelect = useCallback(
    (answerId: string, isSelected: boolean, pageImages: any[]) => {
      // 模範解答は選択対象外
      if (answerId.startsWith("master-")) {
        return
      }

      // 答案が実際に存在するかチェック
      const answerExists = pageImages.some((sheet) => sheet.id === answerId)
      if (!answerExists) {
        return
      }

      setSelectedPageImageIds((prev) => {
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
    selectedPageImageIds,
    layoutDirection,
    currentStudentIndex,
    currentCropRegionId,
    showKeyboardHelp,
    showScoreComparison,
    showSidePanel,
    modifierKeyLabel,
    // アクション関数
    setGradingMode,
    setSelectedPageImageIds,
    setLayoutDirection,
    setCurrentStudentIndex,
    setCurrentCropRegionId,
    setShowKeyboardHelp,
    setShowScoreComparison,
    setShowSidePanel,
    setModifierKeyLabel,
    // ヘルパー関数
    handleAnswerSelect,
  }
}
