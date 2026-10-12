"use client"

import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

import { useAsbGesture } from "../../AsbGestureContext"
import { EditableNumber } from "./EditableNumber"

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
  /** ラベル欄の幅（Tailwind の w-*）。短いラベルだけが並ぶ所では詰める */
  labelWidthClassName?: string
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
  labelWidthClassName = "w-16",
  onChange,
}: SliderWithInputProps) {
  const gesture = useAsbGesture()

  return (
    <div className="flex min-h-6 items-center gap-2">
      <span
        className={cn(
          "shrink-0 text-[10px] text-muted-foreground",
          labelWidthClassName
        )}
      >
        {label}
      </span>
      <Slider
        className="min-w-12 flex-1"
        value={[value]}
        min={min}
        max={max}
        step={step}
        // ジェスチャは**指で動かしている間**のこと。打鍵（矢印キー）は1回で値が
        // 確定する入力なので、始まりを知らせない＝その場で保存される
        onPointerDown={gesture.begin}
        onValueChange={([slidingValue]) => onChange(slidingValue)}
        onValueCommit={gesture.end}
      />
      {/* 入力欄の許容範囲はスライダーと独立に設定できる（既定はスライダーと同じ） */}
      <EditableNumber
        value={value}
        min={inputMin ?? min}
        max={inputMax ?? max}
        step={step}
        decimals={decimals ?? (step < 1 ? 1 : 0)}
        ariaLabel={label}
        onChange={onChange}
      />
    </div>
  )
}
