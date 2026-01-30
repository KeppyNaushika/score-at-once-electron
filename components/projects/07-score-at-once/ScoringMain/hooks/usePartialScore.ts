import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import type {
  CropRegionWithProjectPage,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"

import { useShortcutContext } from "../contexts/ShortcutProvider"

interface UsePartialScoreProps {
  selectedAnswers: Set<string>
  currentCropRegion: CropRegionWithProjectPage | undefined | null
  onBatchScore: (
    status: ScoringStatus,
    score?: number | null,
    partialScore?: number | null,
    selectedAnswers?: Set<string>
  ) => void
}

export function usePartialScore({
  selectedAnswers,
  currentCropRegion,
  onBatchScore,
}: UsePartialScoreProps) {
  const { setContextValue } = useShortcutContext()
  // 部分点入力モーダル用状態
  const [partialScoreInput, setPartialScoreInput] = useState("")
  const [showPartialScoreModal, setShowPartialScoreModal] = useState(false)
  const showExceedsMaxPointsToast = useCallback((maxPoints: number) => {
    toast.warning(`配点を超える値は入力できません（最大${maxPoints}点）`)
  }, [])
  const blurActiveElement = useMemo(() => {
    return () => {
      if (typeof document === "undefined") return
      const activeElement = document.activeElement
      if (activeElement instanceof HTMLElement) {
        activeElement.blur()
      }
    }
  }, [])

  // 部分点入力開始（数字キー・小数点対応）
  const handlePartialScoreInput = useCallback(
    (key: string) => {
      if (selectedAnswers.size === 0 || !currentCropRegion) return

      // モーダルが表示されていない場合は開く
      if (!showPartialScoreModal) {
        setPartialScoreInput("")
        setShowPartialScoreModal(true)
        // useEffect遅延を回避するため同期的にコンテキストを更新
        setContextValue("partialScoreModalOpen", true)
        setContextValue("modalOpen", true)
      }

      const currentInput = partialScoreInput || ""
      let newInput = ""

      // 小数点の処理
      if (key === ".") {
        // 既に小数点が含まれている場合は無視
        if (currentInput.includes(".")) return
        // 空の場合は "0." から開始
        newInput = currentInput === "" ? "0." : currentInput + "."
      } else {
        // 数字キーの処理（左追加）
        newInput = currentInput + key
      }

      // 小数点以下の桁数制限（2桁まで）
      const decimalPart = newInput.split(".")[1]
      if (decimalPart && decimalPart.length > 2) {
        return
      }

      // 数値の妥当性チェック（小数点のみの場合は一旦スキップ）
      if (!newInput.endsWith(".")) {
        const numericValue = parseFloat(newInput)
        const maxPoints = currentCropRegion.points || 10

        // 不正な値や最大点数超過の場合は無視
        if (isNaN(numericValue)) {
          return
        }

        if (numericValue > maxPoints) {
          showExceedsMaxPointsToast(maxPoints)
          return
        }
      }

      setPartialScoreInput(newInput)
    },
    [
      selectedAnswers,
      currentCropRegion,
      partialScoreInput,
      showPartialScoreModal,
      showExceedsMaxPointsToast,
      setContextValue,
    ]
  )

  // F/Jキーで部分点確定
  const handlePartialScoreConfirm = useCallback(
    (confirmType: "partial" | "pending") => {
      if (!showPartialScoreModal || selectedAnswers.size === 0) {
        return
      }

      let finalInput = partialScoreInput

      if (finalInput.trim() === "") {
        onBatchScore(confirmType, null, null, selectedAnswers)
      } else {
        if (finalInput.endsWith(".")) {
          finalInput = finalInput + "0"
        }

        const finalValue = parseFloat(finalInput)
        const maxPoints = currentCropRegion?.points || 10

        // 値の妥当性チェック
        if (!isNaN(finalValue) && finalValue >= 0 && finalValue <= maxPoints) {
          const roundedValue = Math.round(finalValue * 100) / 100
          onBatchScore(confirmType, roundedValue, null, selectedAnswers)
        }
      }

      // モーダルを閉じる
      setPartialScoreInput("")
      setShowPartialScoreModal(false)
      // useEffect遅延を回避するため同期的にコンテキストを更新
      setContextValue("partialScoreModalOpen", false)
      setContextValue("modalOpen", false)
      blurActiveElement()
      setContextValue("inputFocus", false)
    },
    [
      showPartialScoreModal,
      selectedAnswers,
      partialScoreInput,
      currentCropRegion,
      onBatchScore,
      blurActiveElement,
      setContextValue,
    ]
  )

  // モーダルキャンセル（Escape等）
  const handlePartialScoreCancel = useCallback(() => {
    setPartialScoreInput("")
    setShowPartialScoreModal(false)
    // useEffect遅延を回避するため同期的にコンテキストを更新
    setContextValue("partialScoreModalOpen", false)
    setContextValue("modalOpen", false)
    blurActiveElement()
    setContextValue("inputFocus", false)
  }, [blurActiveElement, setContextValue])

  // Backspaceで文字削除
  const handlePartialScoreBackspace = useCallback(() => {
    if (!showPartialScoreModal) return

    const currentInput = partialScoreInput || ""
    if (currentInput.length > 0) {
      setPartialScoreInput(currentInput.slice(0, -1))
    }
  }, [showPartialScoreModal, partialScoreInput])

  // 直接入力変更ハンドラー
  const handlePartialScoreChange = useCallback(
    (value: string) => {
      const maxPoints = currentCropRegion?.points || 10

      // 空文字、数値のみ、または小数点を含む数値のみ許可
      if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
        // 小数点以下の桁数制限（2桁まで）
        const decimalPart = value.split(".")[1]
        if (decimalPart && decimalPart.length > 2) {
          return
        }

        // 数値の妥当性チェック（小数点のみの場合は一旦スキップ）
        if (value !== "" && !value.endsWith(".")) {
          const numericValue = parseFloat(value)

          // 不正な値や最大点数超過の場合は無視
          if (isNaN(numericValue)) {
            return
          }

          if (numericValue > maxPoints) {
            showExceedsMaxPointsToast(maxPoints)
            return
          }
        }

        setPartialScoreInput(value)
      }
    },
    [currentCropRegion, showExceedsMaxPointsToast]
  )

  useEffect(() => {
    if (!showPartialScoreModal) {
      blurActiveElement()
      setContextValue("inputFocus", false)
    }
  }, [showPartialScoreModal, blurActiveElement, setContextValue])

  return {
    partialScoreInput,
    showPartialScoreModal,
    handlePartialScoreInput,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
  }
}
