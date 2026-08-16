"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"

interface GestureColorInputProps {
  /** 保存されている色（`#rrggbb`） */
  value: string
  /** 選び終えたときに1回だけ呼ばれる */
  onCommit: (color: string) => void
  /** 読み上げ用の名前 */
  label: string
  disabled?: boolean
  className?: string
}

/**
 * ジェスチャとして扱う色の入力欄。
 *
 * ネイティブのカラーピッカーは**選んでいる間ずっと `input` を出す**。色相環を
 * なぞるだけで数十回届くので、その途中を書くと DB を叩き続けることになる。
 * 途中は手元に持って見せるだけにし、確定（`change`）のときだけ1回書く。
 *
 * React の `onChange` は `<input type="color">` では `input` に対応する（React が
 * 色を「テキスト系の入力」として扱うため）。**確定を取るには生の `change` を
 * 自分で聴く**しかないので、ref から直に足している。
 *
 * 手元の色は、書いた結果が返ってきたら捨てる（`GestureSlider` と同じ理由）。
 */
export function GestureColorInput({
  value,
  onCommit,
  label,
  disabled,
  className,
}: GestureColorInputProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  /** 選んでいる間の色。まだ書いていない */
  const [picking, setPicking] = useState<string | null>(null)

  // 書いた色が返ってきた。手元の覚えは役目を終える。
  //
  // 大文字小文字は無視する。`<input type="color">` が返すのは小文字（`#fecaca`）
  // だが、保存値は経路によって大文字のこともある。字面で比べると永久に一致せず、
  // 保存されていない色を出したまま `value` に追従しなくなる。
  if (picking !== null && picking.toLowerCase() === value.toLowerCase()) {
    setPicking(null)
  }

  // 最新の `onCommit` を読むが、購読はやり直さない
  const commit = useEffectEvent((color: string) => onCommit(color))

  useEffect(() => {
    const colorInput = colorInputRef.current
    if (!colorInput) return
    const handleCommit = () => commit(colorInput.value.toUpperCase())
    colorInput.addEventListener("change", handleCommit)
    return () => colorInput.removeEventListener("change", handleCommit)
  }, [])

  return (
    <input
      ref={colorInputRef}
      type="color"
      value={picking ?? value}
      onChange={(e) => setPicking(e.target.value)}
      disabled={disabled}
      className={className}
      aria-label={label}
    />
  )
}
