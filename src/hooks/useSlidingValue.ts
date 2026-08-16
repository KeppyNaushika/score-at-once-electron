"use client"

import { useState } from "react"

/**
 * スライダーをジェスチャとして扱う。
 *
 * **つまみを動かしている間の値は意図ではないので書かない。** 途中は手元に持って
 * 見せるだけにし、離したとき（Radix の `onValueCommit`）に1回だけ `onCommit` を
 * 呼ぶ。動かしている間ずっと書くと、1回のドラッグで数十回 DB を叩くうえ、
 * 取り直しと競り合ってつまみが跳ねる。
 *
 * `shown` を返すのは、つまみの隣の数値表示（`5件` `50%` `300ms`）も動かしている
 * 間は手元の値に従わせるため。コンポーネントにせずフックにしてあるのは、
 * つまみと数値の並べ方が画面ごとに違うからである。
 *
 * 手元の値は「書いた結果が返ってきたら」捨てる。離した時点で捨てると、取り直しが
 * 着地するまでの一瞬だけ古い値へ戻って見える。書けなかったときは手元の値が残る
 * が、失敗そのものは `MutationCache` がトーストで知らせる。
 *
 * **`onCommit` に「何もしない関数」を渡さないこと。** 保存値が動かないので手元の
 * 値が返らず、つまみがそこで固まる（以後どの経路の変更も映さなくなる）。
 *
 * @param value 保存されている値
 * @param onCommit つまみを離したときに1回だけ呼ばれる
 */
export function useSlidingValue(
  value: number,
  onCommit: (value: number) => void
) {
  /** 動かしている間の値。まだ書いていない */
  const [sliding, setSliding] = useState<number | null>(null)

  // 書いた値が返ってきた。手元の覚えは役目を終える
  if (sliding === value) setSliding(null)

  const shown = sliding ?? value

  return {
    /** 表示に使う値。動かしている間は手元の値 */
    shown,
    /** `Slider` にそのまま広げる */
    sliderProps: {
      value: [shown],
      onValueChange: ([slidingValue]: number[]) => setSliding(slidingValue),
      onValueCommit: ([committedValue]: number[]) => onCommit(committedValue),
    },
  }
}
