import { useCallback, useState } from "react"

import type { ExtendedDisabledState } from "@/components/projects/05-answer-sheets/answer-sheet-table/types"

export function useDisabledState() {
  const [disabledState, setDisabledState] = useState<ExtendedDisabledState>({
    rows: new Set(),
    cols: new Set(),
    positions: new Set(),
    files: new Set(),
  })

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

  const isPositionDisabled = useCallback(
    (studentIndex: number, pageIndex: number) => {
      const position = studentIndex * 100 + pageIndex // Simple position calculation
      return (
        disabledState.rows.has(studentIndex) ||
        disabledState.cols.has(pageIndex) ||
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
