/**
 * グリッドナビゲーションフック
 */

import { useCallback, useEffect, useState } from "react"

interface UseGridNavigationProps {
  externalItemsPerRow?: number[]
}

/** グリッドの1行あたり表示件数の管理とAlt+[-/+]キーによる増減操作を提供するフック */
export function useGridNavigation({
  externalItemsPerRow,
}: UseGridNavigationProps) {
  const [itemsPerRow, setItemsPerRow] = useState([5])

  // 外部からのitemsPerRowを使用
  useEffect(() => {
    if (externalItemsPerRow) {
      setItemsPerRow(externalItemsPerRow)
    }
  }, [externalItemsPerRow])

  // itemsPerRowの変更を通知（親コンポーネントで保存）
  const handleItemsPerRowChange = useCallback((value: number[]) => {
    setItemsPerRow(value)
  }, [])

  // 答案表示数の増減機能
  const incrementItemsPerRow = useCallback(() => {
    const currentValue = itemsPerRow[0]
    const newValue = Math.min(currentValue + 1, 12)
    handleItemsPerRowChange([newValue])
  }, [handleItemsPerRowChange, itemsPerRow])

  const decrementItemsPerRow = useCallback(() => {
    const currentValue = itemsPerRow[0]
    const newValue = Math.max(currentValue - 1, 2)
    handleItemsPerRowChange([newValue])
  }, [handleItemsPerRowChange, itemsPerRow])

  // Opt + [-/+] キーボードイベント処理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && (event.key === "-" || event.key === "_")) {
        event.preventDefault()
        decrementItemsPerRow()
      } else if (
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
  }
}
