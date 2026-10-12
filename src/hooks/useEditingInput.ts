"use client"

import { useEditingText } from "@/hooks/useEditingText"

/** 入力中の文字を覚えるときの行。この仕組みは設定が1組しか無い画面で使う */
const SETTINGS_ROW = "settings"

/**
 * 1組の設定を編集する入力欄に渡す props を作る。
 *
 * 表示は打った文字を優先し、欄を離れたら保存された値に戻す（`useEditingText`）。
 * 数値欄で、空にした途端に下限へ戻ったり（`3` を消して `8` と打つと `18` になる）、
 * `8.` のような途中が消えたりするのを防ぐ。`commit` は打つたびに呼ぶので、
 * 数にできない途中は `commit` の側で書かずに捨てる。
 */
export function useEditingInput() {
  const { textOf, remember, forgetField } = useEditingText()

  return (field: string, stored: string, commit: (text: string) => void) => ({
    value: textOf(SETTINGS_ROW, field, stored),
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      remember(SETTINGS_ROW, field, event.target.value)
      commit(event.target.value)
    },
    onBlur: () => forgetField(SETTINGS_ROW, field),
  })
}
