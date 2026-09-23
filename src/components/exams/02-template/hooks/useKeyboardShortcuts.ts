/**
 * Custom hook for handling keyboard shortcuts in the image canvas
 *
 * Features:
 * - Delete/Backspace keys to request area deletion (the caller confirms)
 * - Integration with area selection
 *
 * @param selectedAreaIndex - Index of currently selected area
 * @param onRequestDeleteArea - Callback to request deletion of an area
 * @returns Void (sets up event listeners)
 */

import { useEffect } from "react"

/**
 * そのキーを、フォーカスのある要素が自分で使うか。
 * 入力欄の Backspace は文字を消すため、ダイアログの中のキーはダイアログの操作のためにある
 */
const isKeyOwnedByTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('[role="dialog"], [role="alertdialog"]') !== null))

/**
 * 採点領域キャンバスのキーボードショートカット（Delete/Backspaceによる領域削除の要求）を管理するフック。
 *
 * ここでは消さない。領域を消すと採点結果まで消えるので、呼び出し側で確認を挟む
 */
export function useKeyboardShortcuts(
  selectedAreaIndex: number | null,
  onRequestDeleteArea: (index: number) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedAreaIndex === null) return
      if (e.key !== "Backspace" && e.key !== "Delete") return
      // 描いた直後は領域が選ばれたままなので、「配点の初期値」で打った
      // Backspace を削除と取り違えないようにする
      if (isKeyOwnedByTarget(e.target)) return

      e.preventDefault()
      onRequestDeleteArea(selectedAreaIndex)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedAreaIndex, onRequestDeleteArea])
}
