/**
 * Custom hook for handling keyboard shortcuts in the image canvas
 *
 * Features:
 * - Delete/Backspace keys to request area deletion (the caller confirms)
 * - Integration with area selection
 *
 * @param selectedCropRegionId - 選んでいる領域の id
 * @param onRequestDeleteArea - Callback to request deletion of an area
 * @returns Void (sets up event listeners)
 */

import { useEffect } from "react"

import { isTextEntryTarget } from "@/lib/textEntryTarget"

/**
 * そのキーを、フォーカスのある要素が自分で使うか。
 * 入力欄の Backspace は文字を消すため、選択欄・ダイアログの中のキーはその操作のためにある
 */
const isKeyOwnedByTarget = (target: EventTarget | null) =>
  isTextEntryTarget(target) ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement &&
    target.closest('[role="dialog"], [role="alertdialog"]') !== null)

/**
 * 採点領域キャンバスのキーボードショートカット（Delete/Backspaceによる領域削除の要求）を管理するフック。
 *
 * ここでは消さない。領域を消すと採点結果まで消えるので、呼び出し側で確認を挟む
 */
export function useKeyboardShortcuts(
  selectedCropRegionId: string | null,
  onRequestDeleteArea: (cropRegionId: string) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedCropRegionId === null) return
      if (e.key !== "Backspace" && e.key !== "Delete") return
      // 描いた直後は領域が選ばれたままなので、「配点の初期値」で打った
      // Backspace を削除と取り違えないようにする
      if (isKeyOwnedByTarget(e.target)) return

      e.preventDefault()
      onRequestDeleteArea(selectedCropRegionId)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedCropRegionId, onRequestDeleteArea])
}
