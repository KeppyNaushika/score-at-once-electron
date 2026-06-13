"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type {
  BorderConfig,
  LineStyle,
} from "@/types/answerSheetDefinition.types"

interface LineStylePickerProps {
  borderConfig: BorderConfig
  onUpdate: (config: Partial<BorderConfig>) => void
}

const LINE_STYLES: { value: LineStyle; title: string }[] = [
  { value: "solid", title: "実線" },
  { value: "dashed", title: "破線" },
  { value: "dotted", title: "点線" },
]

interface BorderField {
  styleKey: keyof BorderConfig
  widthKey: keyof BorderConfig
  label: string
  defaultWidth: number
  /** 値未設定時に選択表示する線種（任意フィールド用） */
  defaultStyle?: LineStyle
}

const DIVIDER_FIELDS: BorderField[] = [
  {
    styleKey: "outerBorder",
    widthKey: "outerBorderWidth",
    label: "外枠",
    defaultWidth: 0.7,
  },
  {
    styleKey: "majorDivider",
    widthKey: "majorDividerWidth",
    label: "大問",
    defaultWidth: 0.5,
  },
  {
    styleKey: "subDivider",
    widthKey: "subDividerWidth",
    label: "小問",
    defaultWidth: 0.4,
  },
  {
    styleKey: "branchDivider",
    widthKey: "branchDividerWidth",
    label: "枝問",
    defaultWidth: 0.3,
  },
]

const MANUSCRIPT_FIELDS: BorderField[] = [
  {
    styleKey: "manuscriptCharDivider",
    widthKey: "manuscriptCharDividerWidth",
    label: "字間",
    defaultWidth: 0.2,
    defaultStyle: "dashed",
  },
  {
    styleKey: "manuscriptLineDivider",
    widthKey: "manuscriptLineDividerWidth",
    label: "行間",
    defaultWidth: 0.2,
    defaultStyle: "solid",
  },
]

const NUMBER_FIELDS: BorderField[] = [
  {
    styleKey: "majorNumberDivider",
    widthKey: "majorNumberDividerWidth",
    label: "大問",
    defaultWidth: 0.4,
  },
  {
    styleKey: "subNumberDivider",
    widthKey: "subNumberDividerWidth",
    label: "小問",
    defaultWidth: 0.4,
  },
  {
    styleKey: "branchNumberDivider",
    widthKey: "branchNumberDividerWidth",
    label: "枝問",
    defaultWidth: 0.3,
  },
]

function LineIcon({ style }: { style: LineStyle }) {
  const sw = 1.5
  const lineLen = 18 // x2 - x1 = 19 - 1

  let dashProps: {
    strokeDasharray?: string
    strokeDashoffset?: number
  } = {}
  if (style === "dashed") {
    const dash = sw * 3
    const gap = sw * 2
    const period = dash + gap
    const offset = ((lineLen / 2) % period) - dash / 2
    dashProps = { strokeDasharray: `${dash} ${gap}`, strokeDashoffset: offset }
  } else if (style === "dotted") {
    const dash = sw * 1
    const gap = sw * 1
    const period = dash + gap
    const offset = ((lineLen / 2) % period) - dash / 2
    dashProps = { strokeDasharray: `${dash} ${gap}`, strokeDashoffset: offset }
  }

  return (
    <svg width="20" height="10" viewBox="0 0 20 10" className="block">
      <line
        x1="1"
        y1="5"
        x2="19"
        y2="5"
        stroke="currentColor"
        strokeWidth={sw}
        {...dashProps}
      />
    </svg>
  )
}

function EditableValue({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
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
        aria-label="線の太さ"
        className="border-input bg-background box-border h-5 w-8 shrink-0 rounded border text-center text-[10px] outline-none"
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
      className="text-muted-foreground inline-flex h-5 w-8 shrink-0 cursor-pointer items-center justify-end text-[10px] select-none hover:underline"
      onDoubleClick={() => {
        setEditValue(value.toFixed(1))
        setEditing(true)
      }}
      title="ダブルクリックで直接入力"
    >
      {value.toFixed(1)}
    </span>
  )
}

function BorderFieldRow({
  field,
  borderConfig,
  onUpdate,
}: {
  field: BorderField
  borderConfig: BorderConfig
  onUpdate: (config: Partial<BorderConfig>) => void
}) {
  const width =
    (borderConfig[field.widthKey] as number | undefined) ?? field.defaultWidth
  const activeStyle =
    (borderConfig[field.styleKey] as LineStyle | undefined) ??
    field.defaultStyle
  return (
    <div className="flex min-h-6 items-center gap-2">
      <span className="text-muted-foreground w-8 shrink-0 text-[10px]">
        {field.label}
      </span>
      <div className="border-input flex shrink-0 rounded-md border">
        {LINE_STYLES.map((ls) => (
          <button
            key={ls.value}
            type="button"
            title={ls.title}
            className={cn(
              "hover:bg-accent flex h-6 w-7 items-center justify-center transition-colors first:rounded-l-md last:rounded-r-md",
              activeStyle === ls.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            )}
            onClick={() =>
              onUpdate({ [field.styleKey]: ls.value as LineStyle })
            }
          >
            <LineIcon style={ls.value} />
          </button>
        ))}
      </div>
      <Slider
        className="min-w-12 flex-1"
        value={[width]}
        min={0.1}
        max={1.5}
        step={0.1}
        onValueChange={([v]) => onUpdate({ [field.widthKey]: v })}
      />
      <EditableValue
        value={width}
        min={0.1}
        max={1.5}
        step={0.1}
        onChange={(v) => onUpdate({ [field.widthKey]: v })}
      />
    </div>
  )
}

export function LineStylePicker({
  borderConfig,
  onUpdate,
}: LineStylePickerProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="text-muted-foreground text-[10px]">区切り線</span>
        {DIVIDER_FIELDS.map((field) => (
          <BorderFieldRow
            key={field.styleKey}
            field={field}
            borderConfig={borderConfig}
            onUpdate={onUpdate}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        <span className="text-muted-foreground text-[10px]">番号列</span>
        {NUMBER_FIELDS.map((field) => (
          <BorderFieldRow
            key={field.styleKey}
            field={field}
            borderConfig={borderConfig}
            onUpdate={onUpdate}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        <span className="text-muted-foreground text-[10px]">
          原稿用紙マス目
        </span>
        {MANUSCRIPT_FIELDS.map((field) => (
          <BorderFieldRow
            key={field.styleKey}
            field={field}
            borderConfig={borderConfig}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  )
}
