import { useEffect, useRef } from "react"

/**
 * Radix の Dialog / Popover を開いたときに、指定の input へ確定的にフォーカスを当てる。
 *
 * `autoFocus` 属性頼みにすると、React の `.focus()`・Radix `FocusScope` の
 * マウント時オートフォーカス・開いた直後の state リセット再レンダーが同一フレームで
 * 競合し、本番（minify済み）ビルドではフォーカスが input ではなく Content
 * コンテナに残ることがある（issue #916）。
 *
 * 返り値の `inputRef` を対象 input に、`onOpenAutoFocus` を
 * `DialogContent` / `PopoverContent` に渡して使う。
 */
export function useDialogAutoFocus(open: boolean) {
  const inputRef = useRef<HTMLInputElement>(null)

  // 閉じるアニメーション（duration-200）の最中に開き直すと、Radix Presence が
  // Content ノードを保持したままになり FocusScope のマウント効果＝
  // onOpenAutoFocus が再発火しない。open の変化でも当て直して取りこぼしを防ぐ。
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  const onOpenAutoFocus = (event: Event) => {
    const input = inputRef.current
    // フォーカスできない状態（未マウント・disabled）では preventDefault すると
    // Radix のフォールバックまで潰してフォーカスが focus scope の外に残るため、
    // 既定の挙動に委ねる。
    if (!input || input.disabled) {
      return
    }
    event.preventDefault()
    input.focus()
  }

  return { inputRef, onOpenAutoFocus }
}
