"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Slider } from "@/components/ui/slider"

import { useAsbGesture } from "../../AsbGestureContext"

interface SliderWithInputProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  /** 表示小数桁数 (デフォルト: step < 1 なら1、それ以外は0) */
  decimals?: number
  /** 数値入力欄の下限（スライダーとは別。未指定 = min）。負値・-Infinity 可 */
  inputMin?: number
  /** 数値入力欄の上限（スライダーとは別。未指定 = max）。Infinity 可 */
  inputMax?: number
  onChange: (value: number) => void
}

export function SliderWithInput({
  label,
  value,
  min,
  max,
  step,
  decimals,
  inputMin,
  inputMax,
  onChange,
}: SliderWithInputProps) {
  // 入力欄の許容範囲はスライダーと独立に設定できる（既定はスライダーと同じ）
  const lo = inputMin ?? min
  const hi = inputMax ?? max
  const displayDecimals = decimals ?? (step < 1 ? 1 : 0)
  const gesture = useAsbGesture()
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
      if (!isNaN(parsed) && parsed >= lo && parsed <= hi) {
        onChange(parsed)
      }
    },
    [lo, hi, onChange]
  )

  const startEdit = useCallback(() => {
    setEditValue(value.toFixed(displayDecimals))
    setEditing(true)
  }, [value, displayDecimals])

  return (
    <div className="flex min-h-6 items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-muted-foreground">
        {label}
      </span>
      <Slider
        className="min-w-12 flex-1"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([slidingValue]) => {
          // つまみを動かしている間もプレビューへ映す。保存だけを離すまで待たせる
          gesture.begin()
          onChange(slidingValue)
        }}
        onValueCommit={gesture.end}
      />
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          aria-label={label}
          className="box-border h-5 w-10 shrink-0 rounded border border-input bg-background text-center text-[10px] outline-none"
          value={editValue}
          min={Number.isFinite(lo) ? lo : undefined}
          max={Number.isFinite(hi) ? hi : undefined}
          step={step}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditing(false)
          }}
        />
      ) : (
        <span
          className="inline-flex h-5 w-10 shrink-0 cursor-pointer items-center justify-end text-[10px] text-muted-foreground select-none hover:underline"
          onDoubleClick={startEdit}
          title="ダブルクリックで直接入力"
        >
          {value.toFixed(displayDecimals)}
        </span>
      )}
    </div>
  )
}
