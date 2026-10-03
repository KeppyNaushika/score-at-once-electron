import { useCallback } from "react"

/** 一覧の1行あたりの表示件数を増減する（ショートカットキー =/-/0） */
export function useGridZoom(
  itemsPerLine: number[],
  setItemsPerLine: (itemsPerLine: number[]) => void
) {
  const handleZoomIn = useCallback(() => {
    const next = Math.min(itemsPerLine[0] + 1, 10)
    setItemsPerLine([next])
  }, [itemsPerLine, setItemsPerLine])

  const handleZoomOut = useCallback(() => {
    const next = Math.max(itemsPerLine[0] - 1, 1)
    setItemsPerLine([next])
  }, [itemsPerLine, setItemsPerLine])

  const handleResetZoom = useCallback(() => {
    setItemsPerLine([5])
  }, [setItemsPerLine])

  return { handleZoomIn, handleZoomOut, handleResetZoom }
}
