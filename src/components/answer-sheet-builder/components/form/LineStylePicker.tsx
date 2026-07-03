"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type {
  BorderConfig,
  LineStyle,
} from "@/types/answerSheetDefinition.types"

import { DEFAULT_DASH_RATIO, DEFAULT_GAP_RATIO } from "../../constants"

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
  /** 破線ダッシュ長の倍率キー（線幅に対する倍率） */
  dashRatioKey: keyof BorderConfig
  /** 破線/点線の間隔の倍率キー（線幅に対する倍率） */
  gapRatioKey: keyof BorderConfig
  label: string
  defaultWidth: number
  /** 値未設定時に選択表示する線種（任意フィールド用） */
  defaultStyle?: LineStyle
}

const DIVIDER_FIELDS: BorderField[] = [
  {
    styleKey: "outerBorder",
    widthKey: "outerBorderWidth",
    dashRatioKey: "outerBorderDashRatio",
    gapRatioKey: "outerBorderGapRatio",
    label: "外枠",
    defaultWidth: 0.7,
  },
  {
    styleKey: "majorDivider",
    widthKey: "majorDividerWidth",
    dashRatioKey: "majorDividerDashRatio",
    gapRatioKey: "majorDividerGapRatio",
    label: "大問",
    defaultWidth: 0.5,
  },
  {
    styleKey: "subDivider",
    widthKey: "subDividerWidth",
    dashRatioKey: "subDividerDashRatio",
    gapRatioKey: "subDividerGapRatio",
    label: "小問",
    defaultWidth: 0.4,
  },
  {
    styleKey: "branchDivider",
    widthKey: "branchDividerWidth",
    dashRatioKey: "branchDividerDashRatio",
    gapRatioKey: "branchDividerGapRatio",
    label: "枝問",
    defaultWidth: 0.3,
  },
]

const MANUSCRIPT_FIELDS: BorderField[] = [
  {
    styleKey: "manuscriptCharDivider",
    widthKey: "manuscriptCharDividerWidth",
    dashRatioKey: "manuscriptCharDividerDashRatio",
    gapRatioKey: "manuscriptCharDividerGapRatio",
    label: "字間",
    defaultWidth: 0.2,
    defaultStyle: "dashed",
  },
  {
    styleKey: "manuscriptLineDivider",
    widthKey: "manuscriptLineDividerWidth",
    dashRatioKey: "manuscriptLineDividerDashRatio",
    gapRatioKey: "manuscriptLineDividerGapRatio",
    label: "行間",
    defaultWidth: 0.2,
    defaultStyle: "solid",
  },
]

const NUMBER_FIELDS: BorderField[] = [
  {
    styleKey: "majorNumberDivider",
    widthKey: "majorNumberDividerWidth",
    dashRatioKey: "majorNumberDividerDashRatio",
    gapRatioKey: "majorNumberDividerGapRatio",
    label: "大問",
    defaultWidth: 0.4,
  },
  {
    styleKey: "subNumberDivider",
    widthKey: "subNumberDividerWidth",
    dashRatioKey: "subNumberDividerDashRatio",
    gapRatioKey: "subNumberDividerGapRatio",
    label: "小問",
    defaultWidth: 0.4,
  },
  {
    styleKey: "branchNumberDivider",
    widthKey: "branchNumberDividerWidth",
    dashRatioKey: "branchNumberDividerDashRatio",
    gapRatioKey: "branchNumberDividerGapRatio",
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
  const dashRatio =
    (borderConfig[field.dashRatioKey] as number | undefined) ??
    DEFAULT_DASH_RATIO
  const gapRatio =
    (borderConfig[field.gapRatioKey] as number | undefined) ?? DEFAULT_GAP_RATIO
  // 破線はダッシュ長・間隔の両方、点線は間隔のみ調整できる
  const showDash = activeStyle === "dashed"
  const showGap = activeStyle === "dashed" || activeStyle === "dotted"
  return (
    <div className="space-y-1">
      <div className="flex min-h-6 items-center gap-2">
        <span className="text-muted-foreground w-8 shrink-0 text-[10px]">
          {field.label}
        </span>
        <div className="border-input flex shrink-0 rounded-md border">
          {LINE_STYLES.map((lineStyle) => (
            <button
              key={lineStyle.value}
              type="button"
              title={lineStyle.title}
              className={cn(
                "hover:bg-accent flex h-6 w-7 items-center justify-center transition-colors first:rounded-l-md last:rounded-r-md",
                activeStyle === lineStyle.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
              onClick={() =>
                onUpdate({ [field.styleKey]: lineStyle.value as LineStyle })
              }
            >
              <LineIcon style={lineStyle.value} />
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
      {showGap && (
        <div className="flex items-center gap-2 pl-10">
          {showDash && (
            <div className="flex flex-1 items-center gap-1.5">
              <span
                className="text-muted-foreground w-7 shrink-0 text-[9px]"
                title="ダッシュ長（線幅に対する倍率）"
              >
                破線
              </span>
              <Slider
                className="min-w-10 flex-1"
                value={[dashRatio]}
                min={0.5}
                max={10}
                step={0.5}
                onValueChange={([v]) => onUpdate({ [field.dashRatioKey]: v })}
              />
              <EditableValue
                value={dashRatio}
                min={0.5}
                max={10}
                step={0.5}
                onChange={(v) => onUpdate({ [field.dashRatioKey]: v })}
              />
            </div>
          )}
          <div className="flex flex-1 items-center gap-1.5">
            <span
              className="text-muted-foreground w-7 shrink-0 text-[9px]"
              title="間隔（線幅に対する倍率）"
            >
              間隔
            </span>
            <Slider
              className="min-w-10 flex-1"
              value={[gapRatio]}
              min={0.5}
              max={10}
              step={0.5}
              onValueChange={([v]) => onUpdate({ [field.gapRatioKey]: v })}
            />
            <EditableValue
              value={gapRatio}
              min={0.5}
              max={10}
              step={0.5}
              onChange={(v) => onUpdate({ [field.gapRatioKey]: v })}
            />
          </div>
        </div>
      )}
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
