"use client"

import { useCallback, useState } from "react"

/**
 * 入力中の文字だけを手元に持つ。
 *
 * 1打鍵ごとに書く入力欄は、**取り直しが打鍵の合間に着地すると値が戻る**。
 * 書き込みは直列化できても、それより前に始まった取得は止まらないためである。
 * 戻った文字列に次の打鍵が足されるので、DB には壊れた値が入る（`設問` と打って
 * `設1` が保存される。R1 #5 で実測）。
 *
 * 表示は入力中の文字を優先し、行が消えたときだけ忘れる。数値欄で `""` や `8.`
 * のような「まだ数にできない途中」を保てるのも同じ仕組みによる。
 */
export function useEditingText() {
  const [texts, setTexts] = useState<ReadonlyMap<string, string>>(new Map())

  /** 入力中の文字を引く鍵。DB の鍵ではなく、その画面だけの覚え */
  const keyOf = (rowId: string, field: string) => `${rowId}:${field}`

  /** 表示する文字。入力中ならその文字、そうでなければ保存されている値 */
  const textOf = useCallback(
    (rowId: string, field: string, stored: string) =>
      texts.get(keyOf(rowId, field)) ?? stored,
    [texts]
  )

  const remember = useCallback((rowId: string, field: string, text: string) => {
    setTexts((previous) => new Map(previous).set(keyOf(rowId, field), text))
  }, [])

  /** その欄の覚えを捨てる（入力を離れたとき） */
  const forgetField = useCallback((rowId: string, field: string) => {
    setTexts((previous) => {
      const next = new Map(previous)
      next.delete(keyOf(rowId, field))
      return next
    })
  }, [])

  /**
   * その行の覚えを全て捨てる（行を消したとき）。
   *
   * 入力を離れただけのときにこれを使わないこと。同じ行の別の欄がまだ入力中で、
   * 書き込みも飛んでいる最中なので、その文字まで消すと隣の欄が一瞬だけ古い値へ
   * 戻って見える（`useEditingText` が防いでいるはずのちらつきそのもの）。
   */
  const forget = useCallback((rowId: string) => {
    setTexts((previous) => {
      const next = new Map(previous)
      for (const key of next.keys()) {
        if (key.startsWith(`${rowId}:`)) next.delete(key)
      }
      return next
    })
  }, [])

  return { textOf, remember, forgetField, forget }
}
