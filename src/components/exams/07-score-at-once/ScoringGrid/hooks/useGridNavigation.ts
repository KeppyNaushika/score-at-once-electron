/**
 * グリッドナビゲーションフック
 */

import { useCallback, useEffect, useMemo, useState } from "react"

interface UseGridNavigationProps {
  externalItemsPerRow?: number[]
}

/** グリッドの1行あたり表示件数の管理とAlt+[-/+]キーによる増減操作を提供するフック */
export function useGridNavigation({
  externalItemsPerRow,
}: UseGridNavigationProps) {
  // Alt+[-/+] によるこの画面だけの上書き。null なら外部指定に追従する
  const [overrideItemsPerRow, setOverrideItemsPerRow] = useState<
    number[] | null
  >(null)
  const itemsPerRow = useMemo(
    () => overrideItemsPerRow ?? externalItemsPerRow ?? [5],
    [overrideItemsPerRow, externalItemsPerRow]
  )

  const handleItemsPerRowChange = useCallback((value: number[]) => {
    setOverrideItemsPerRow(value)
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
