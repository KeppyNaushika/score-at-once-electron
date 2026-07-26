import { useCallback, useRef, useState } from "react"

import type {
  GradingMode,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import { getModifierKeyLabel } from "@/lib/platformUtils"

/** 採点メイン画面のUI状態（モード・選択・パネル表示等）を一括管理するフック */
export function useScoringMainState() {
  /** 採点モード状態 */
  const [gradingMode, setGradingMode] = useState<GradingMode>("grid")
  /** 選択中の答案ID集合 */
  const [selectedStudentAnswerImageIds, setSelectedPageImageIds] = useState<
    Set<string>
  >(new Set())
  const [manualSelectionVersion, setManualSelectionVersion] = useState(0)
  const suppressSelectionUpdateRef = useRef(false)
  /** 現在選択中の生徒インデックス */
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  /** 選択中の設問領域ID */
  const [currentCropRegionId, setCurrentCropRegionId] = useState<string | null>(
    null
  )
  /** キーボードヘルプ表示状態 */
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  /** 採点結果の確定（裁定）パネル表示状態 */
  const [showScoreDecisionPanel, setShowScoreDecisionPanel] = useState(false)
  /** サイドパネル表示状態 */
  const [showSidePanel, setShowSidePanel] = useState(true)
  /** ショートカットで利用する修飾キー表示ラベル */
  const [modifierKeyLabel] = useState(() => getModifierKeyLabel() || "Alt")

  /**
   * 単一クリック・ショートカットによる選択更新
   */
  const handleAnswerSelect = useCallback(
    (
      answerId: string,
      isSelected: boolean,
      studentAnswerImages: StudentAnswerImageWithExamStudents[]
    ) => {
      if (suppressSelectionUpdateRef.current) {
        return
      }
      if (answerId.startsWith("master-")) {
        return
      }

      const answerExists = studentAnswerImages.some(
        (sheet) => sheet.id === answerId
      )
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
    []
  )

  /**
   * 複数選択置き換え用のヘルパー
   */
  const replaceSelection = useCallback((ids: string[]) => {
    suppressSelectionUpdateRef.current = true
    setSelectedPageImageIds(new Set(ids))
    setManualSelectionVersion((version) => version + 1)
    queueMicrotask(() => {
      suppressSelectionUpdateRef.current = false
    })
  }, [])

  return {
    /** 個別の状態 */
    gradingMode,
    selectedStudentAnswerImageIds,
    currentStudentIndex,
    currentCropRegionId,
    showKeyboardHelp,
    showScoreDecisionPanel,
    showSidePanel,
    modifierKeyLabel,
    manualSelectionVersion,
    /** アクション関数 */
    setGradingMode,
    setSelectedPageImageIds,
    setCurrentStudentIndex,
    setCurrentCropRegionId,
    setShowKeyboardHelp,
    setShowScoreDecisionPanel,
    setShowSidePanel,
    /** ヘルパー関数 */
    handleAnswerSelect,
    replaceSelection,
  }
}
