"use client"

import { useState } from "react"

/**
 * 確認の窓の「開いているか」と「何についての窓か」を別々に持つ。
 *
 * 対象が null かどうかで開閉を決めると、閉じた瞬間に対象が消え、閉じるアニメーション
 * （duration-200）の間だけ名前や件数が空になって見える。ここでは**閉じても対象を
 * 残す**ので、窓は最後まで開いたときの中身のまま消える。対象は次に開くときに入れ替わる。
 *
 * 閉じたあとも `target` は null に戻らない。「いま処理待ちの対象があるか」の判定には
 * `target` ではなく `isOpen` を使うこと。
 */
export function useDialogTarget<T>() {
  const [target, setTarget] = useState<T | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  /** 対象を入れ替えて開く */
  const openWith = (nextTarget: T) => {
    setTarget(nextTarget)
    setIsOpen(true)
  }

  /** 閉じる。対象は残す */
  const close = () => setIsOpen(false)

  /** Radix の `onOpenChange` にそのまま渡す（閉じる向きだけを受ける） */
  const handleOpenChange = (open: boolean) => {
    if (!open) close()
  }

  return { target, isOpen, openWith, close, handleOpenChange }
}
