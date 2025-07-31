import { useCallback, useEffect, useState } from "react"

interface UseGridNavigationProps {
  onEffectiveColumnsChange?: (columns: number) => void
  externalItemsPerRow?: number[]
}

export function useGridNavigation({
  onEffectiveColumnsChange,
  externalItemsPerRow,
}: UseGridNavigationProps) {
  const [itemsPerRow, setItemsPerRow] = useState([5]) // 1行あたりの表示件数 (0-10)

  // 外部からのitemsPerRowを優先し、ない場合はlocalStorageから読み込み
  useEffect(() => {
    if (externalItemsPerRow) {
      setItemsPerRow(externalItemsPerRow)
      if (onEffectiveColumnsChange) {
        onEffectiveColumnsChange(externalItemsPerRow[0])
      }
    } else {
      const stored = localStorage.getItem("answerGridView-itemsPerRow")
      let initialValue = [5] // デフォルト値
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (
            Array.isArray(parsed) &&
            parsed.length === 1 &&
            typeof parsed[0] === "number" &&
            parsed[0] >= 1 &&
            parsed[0] <= 10
          ) {
            initialValue = parsed
            setItemsPerRow(parsed)
          }
        } catch (error) {
          console.warn("Failed to parse stored itemsPerRow:", error)
        }
      }
      // 親コンポーネントに初期値を通知
      if (onEffectiveColumnsChange) {
        onEffectiveColumnsChange(initialValue[0])
      }
    }
  }, [externalItemsPerRow, onEffectiveColumnsChange])

  // itemsPerRowの変更をlocalStorageに保存
  const handleItemsPerRowChange = useCallback(
    (value: number[]) => {
      setItemsPerRow(value)
      localStorage.setItem("answerGridView-itemsPerRow", JSON.stringify(value))
      // 親コンポーネントに実際の列数を通知
      if (onEffectiveColumnsChange) {
        onEffectiveColumnsChange(value[0])
      }
    },
    [onEffectiveColumnsChange],
  )

  // 答案表示数の増減機能
  const incrementItemsPerRow = useCallback(() => {
    const currentValue = itemsPerRow[0]
    const newValue = Math.min(currentValue + 1, 12) // 最大12列
    handleItemsPerRowChange([newValue])
  }, [handleItemsPerRowChange, itemsPerRow])

  const decrementItemsPerRow = useCallback(() => {
    const currentValue = itemsPerRow[0]
    const newValue = Math.max(currentValue - 1, 2) // 最小2列
    handleItemsPerRowChange([newValue])
  }, [handleItemsPerRowChange, itemsPerRow])

  // Opt + [-/+] キーボードイベント処理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Option/Alt + Minus で減少
      if (event.altKey && (event.key === "-" || event.key === "_")) {
        event.preventDefault()
        decrementItemsPerRow()
      }
      // Option/Alt + Plus で増加
      else if (
        event.altKey &&
        (event.key === "+" || event.key === "=" || event.key === "Equal")
      ) {
        event.preventDefault()
        incrementItemsPerRow()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [incrementItemsPerRow, decrementItemsPerRow])

  return {
    itemsPerRow,
    handleItemsPerRowChange,
    incrementItemsPerRow,
    decrementItemsPerRow,
  }
}