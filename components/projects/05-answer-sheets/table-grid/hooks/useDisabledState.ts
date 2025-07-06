import { useCallback, useState } from "react"
import type { ExtendedDisabledState } from "../types"

export function useDisabledState() {
  const [disabledState, setDisabledState] = useState<ExtendedDisabledState>({
    rows: new Set<number>(),
    cols: new Set<number>(),
    positions: new Set<number>(),
    cells: new Set<string>(), // ファイルID単位の無効化（既存、現在未使用）
    files: new Set<string>(), // ファイル答案無効化（コンテキストメニュー用）
  })

  // 行の無効化切り替え
  const toggleRowDisabled = useCallback((rowIndex: number) => {
    setDisabledState((prev) => {
      const newRows = new Set(prev.rows)
      if (newRows.has(rowIndex)) {
        newRows.delete(rowIndex)
      } else {
        newRows.add(rowIndex)
      }
      return { ...prev, rows: newRows }
    })
  }, [])

  // 列の無効化切り替え
  const toggleColDisabled = useCallback((colIndex: number) => {
    setDisabledState((prev) => {
      const newCols = new Set(prev.cols)
      if (newCols.has(colIndex)) {
        newCols.delete(colIndex)
      } else {
        newCols.add(colIndex)
      }
      return { ...prev, cols: newCols }
    })
  }, [])

  // ポジションの無効化切り替え
  const togglePositionDisabled = useCallback((position: number) => {
    setDisabledState((prev) => {
      const newPositions = new Set(prev.positions)
      if (newPositions.has(position)) {
        newPositions.delete(position)
      } else {
        newPositions.add(position)
      }
      return { ...prev, positions: newPositions }
    })
  }, [])

  // ファイルの無効化切り替え
  const toggleFileDisabled = useCallback((fileId: string) => {
    setDisabledState((prev) => {
      const newFiles = new Set(prev.files)
      if (newFiles.has(fileId)) {
        newFiles.delete(fileId)
      } else {
        newFiles.add(fileId)
      }
      return { ...prev, files: newFiles }
    })
  }, [])

  // ポジションが無効化されているかチェック
  const isPositionDisabled = useCallback(
    (position: number, maxPages: number) => {
      const row = Math.floor(position / maxPages)
      const col = position % maxPages

      return (
        disabledState.rows.has(row) ||
        disabledState.cols.has(col) ||
        disabledState.positions.has(position)
      )
    },
    [disabledState],
  )

  return {
    disabledState,
    setDisabledState,
    toggleRowDisabled,
    toggleColDisabled,
    togglePositionDisabled,
    toggleFileDisabled,
    isPositionDisabled,
  }
}