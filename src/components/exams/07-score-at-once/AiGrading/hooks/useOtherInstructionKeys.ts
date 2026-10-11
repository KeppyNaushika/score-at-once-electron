/**
 * 問いかけの「その他：再採点を指示する」の欄のキー（docs/vlm-grading-design.md §3-5・§11-4）。
 *
 * - 素の Enter は日本語入力の変換の確定と改行に残す（送らない）。変換中のキーは見ない
 *   （`isComposing`・keyCode 229）
 * - 次へ・戻る（既定は Ctrl/⌘+Enter・Ctrl/⌘+Shift+Enter）は、欄の中でも外でも同じ登録が効く
 *   （`useQuestioningFlow` が問いかけの場面で登録する）ので、ここでは見ない
 * - カーソルが1行目にあるときの ↑ は、欄を抜けて上の選択肢へ戻る（2行目以降の ↑ は普通の行の移動）
 * - Esc は欄から抜ける
 */

import type { KeyboardEvent } from "react"

interface UseOtherInstructionKeysOptions {
  /** 1行目の ↑：欄を抜けて上の選択肢へ */
  onLeaveUpward: () => void
}

/** カーソルが1行目にあるか（カーソルより前に改行が無い） */
const isCaretOnFirstLine = (textarea: HTMLTextAreaElement): boolean =>
  !textarea.value.slice(0, textarea.selectionStart).includes("\n")

export function useOtherInstructionKeys({
  onLeaveUpward,
}: UseOtherInstructionKeysOptions) {
  return (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === "Escape") {
      event.currentTarget.blur()
      return
    }
    const hasModifier =
      event.shiftKey || event.ctrlKey || event.metaKey || event.altKey
    if (
      event.key === "ArrowUp" &&
      !hasModifier &&
      isCaretOnFirstLine(event.currentTarget)
    ) {
      event.preventDefault()
      onLeaveUpward()
    }
  }
}
