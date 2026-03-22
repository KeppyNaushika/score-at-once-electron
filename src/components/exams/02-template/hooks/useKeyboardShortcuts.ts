/**
 * Custom hook for handling keyboard shortcuts in the image canvas
 *
 * Features:
 * - Delete/Backspace keys for area deletion
 * - Integration with area selection
 *
 * @param selectedAreaIndex - Index of currently selected area
 * @param onDeleteArea - Callback to delete an area
 * @returns Void (sets up event listeners)
 */

import { useEffect } from "react"

/** 採点領域キャンバスのキーボードショートカット（Delete/Backspaceによる領域削除）を管理するフック */
export function useKeyboardShortcuts(
  selectedAreaIndex: number | null,
  onDeleteArea: (index: number) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 削除機能
      if (selectedAreaIndex !== null) {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault()
          onDeleteArea(selectedAreaIndex)
          return
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedAreaIndex, onDeleteArea])
}
