"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import type { OMRMarkerConfig } from "@/types/answerSheetDefinition.types"

interface OMRMarkerSettingsProps {
  config: OMRMarkerConfig
  onUpdate: (config: Partial<OMRMarkerConfig>) => void
}

function EditableValue({
  value,
  min,
  max,
  step,
  decimals = 1,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  decimals?: number
  onChange: (v: number) => void
}) {
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
        aria-label="値を入力"
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
    )
  }

  return (
    <span
      className="text-muted-foreground inline-flex h-5 w-10 shrink-0 cursor-pointer items-center justify-end text-[10px] select-none hover:underline"
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

export function OMRMarkerSettings({
  config,
  onUpdate,
}: OMRMarkerSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-semibold">
          OMRマーカー
        </h3>
        <Switch
          checked={config.enabled}
          onCheckedChange={(v) => onUpdate({ enabled: v })}
        />
      </div>

      {config.enabled && (
        <div className="space-y-1.5">
          <div className="flex min-h-6 items-center gap-2">
            <span className="text-muted-foreground w-8 shrink-0 text-[10px]">
              サイズ
            </span>
            <Slider
              className="min-w-12 flex-1"
              value={[config.sizeMm]}
              min={1.5}
              max={15}
              step={0.5}
              onValueChange={([v]) => onUpdate({ sizeMm: v })}
            />
            <EditableValue
              value={config.sizeMm}
              min={0.5}
              max={15}
              step={0.5}
              onChange={(v) => onUpdate({ sizeMm: v })}
            />
          </div>
          <div className="flex min-h-6 items-center gap-2">
            <span className="text-muted-foreground w-8 shrink-0 text-[10px]">
              余白
            </span>
            <Slider
              className="min-w-12 flex-1"
              value={[config.offsetMm]}
              min={5}
              max={20}
              step={0.5}
              onValueChange={([v]) => onUpdate({ offsetMm: v })}
            />
            <EditableValue
              value={config.offsetMm}
              min={0}
              max={20}
              step={0.5}
              onChange={(v) => onUpdate({ offsetMm: v })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
