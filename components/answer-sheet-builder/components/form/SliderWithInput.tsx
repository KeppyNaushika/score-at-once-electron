"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Slider } from "@/components/ui/slider"

interface SliderWithInputProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  /** 表示小数桁数 (デフォルト: step < 1 なら1、それ以外は0) */
  decimals?: number
  onChange: (value: number) => void
}

export function SliderWithInput({
  label,
  value,
  min,
  max,
  step,
  decimals,
  onChange,
}: SliderWithInputProps) {
  const displayDecimals = decimals ?? (step < 1 ? 1 : 0)
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

  const startEdit = useCallback(() => {
    setEditValue(value.toFixed(displayDecimals))
    setEditing(true)
  }, [value, displayDecimals])

  return (
    <div className="flex min-h-6 items-center gap-2">
      <span className="text-muted-foreground w-16 shrink-0 text-[10px]">
        {label}
      </span>
      <Slider
        className="min-w-12 flex-1"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          aria-label={label}
          className="border-input bg-background box-border h-5 w-10 shrink-0 rounded border text-center text-[10px] outline-none"
          value={editValue}
          min={min}
          max={max}
          step={step}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") setEditing(false)
          }}
        />
      ) : (
        <span
          className="text-muted-foreground inline-flex h-5 w-10 shrink-0 cursor-pointer items-center justify-end text-[10px] select-none hover:underline"
          onDoubleClick={startEdit}
          title="ダブルクリックで直接入力"
        >
          {value.toFixed(displayDecimals)}
        </span>
      )}
    </div>
  )
}
