"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface EditableNumberProps {
  value: number
  /** 打てる下限。負値・-Infinity 可 */
  min: number
  /** 打てる上限。Infinity 可 */
  max: number
  step: number
  /** 表示小数桁数 */
  decimals: number
  ariaLabel: string
  /** 欄の幅（Tailwind の w-*）。並べる行の詰まり具合で変える */
  widthClassName?: string
  onChange: (value: number) => void
}

/**
 * スライダー横の数値。ダブルクリックで入力欄に変わり、直接打てる。
 *
 * 打っている途中の文字は欄を離れるまで手元に置き、範囲内の数になった打鍵だけを
 * 書き込む。空や範囲外は書かずに捨てるので、離れれば最後に書いた値の表示へ戻る。
 */
export function EditableNumber({
  value,
  min,
  max,
  step,
  decimals,
  ariaLabel,
  widthClassName = "w-10",
  onChange,
}: EditableNumberProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const handleChange = useCallback(
    (raw: string) => {
      setEditValue(raw)
      const parsed = parseFloat(raw)
      if (!isNaN(parsed) && parsed >= min && parsed <= max) {
        onChange(parsed)
      }
    },
    [min, max, onChange]
  )

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        aria-label={ariaLabel}
        className={cn(
          "box-border h-5 shrink-0 rounded border border-input bg-background text-center text-[10px] outline-none",
          widthClassName
        )}
        value={editValue}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        step={step}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") setEditing(false)
        }}
      />
    )
  }

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 cursor-pointer items-center justify-end text-[10px] text-muted-foreground select-none hover:underline",
        widthClassName
      )}
      onDoubleClick={() => {
        setEditValue(value.toFixed(decimals))
        setEditing(true)
      }}
      title="ダブルクリックで直接入力"
    >
      {value.toFixed(decimals)}
    </span>
  )
}
