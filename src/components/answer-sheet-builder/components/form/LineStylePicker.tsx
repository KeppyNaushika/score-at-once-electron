"use client"

import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type {
  BorderConfig,
  BorderLineStyle,
} from "@/types/answerSheetDefinition.types"

import { useAsbGesture } from "../../AsbGestureContext"
import { DEFAULT_DASH_RATIO, DEFAULT_GAP_RATIO } from "../../constants"
import { EditableNumber } from "./EditableNumber"

interface LineStylePickerProps {
  borderConfig: BorderConfig
  onUpdate: (config: Partial<BorderConfig>) => void
}

const LINE_STYLES: { value: BorderLineStyle; title: string }[] = [
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
  defaultStyle?: BorderLineStyle
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

function LineIcon({ style }: { style: BorderLineStyle }) {
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

function BorderFieldRow({
  field,
  borderConfig,
  onUpdate,
}: {
  field: BorderField
  borderConfig: BorderConfig
  onUpdate: (config: Partial<BorderConfig>) => void
}) {
  const gesture = useAsbGesture()
  const width =
    (borderConfig[field.widthKey] as number | undefined) ?? field.defaultWidth
  const activeStyle =
    (borderConfig[field.styleKey] as BorderLineStyle | undefined) ??
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
        <span className="w-8 shrink-0 text-[10px] text-muted-foreground">
          {field.label}
        </span>
        <div className="flex shrink-0 rounded-md border border-input">
          {LINE_STYLES.map((lineStyle) => (
            <Tooltip key={lineStyle.value}>
              <TooltipTrigger asChild>
                <button
                  aria-label={lineStyle.title}
                  type="button"
                  className={cn(
                    "flex h-6 w-7 items-center justify-center transition-colors first:rounded-l-md last:rounded-r-md hover:bg-accent",
                    activeStyle === lineStyle.value
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground"
                  )}
                  onClick={() =>
                    onUpdate({
                      [field.styleKey]: lineStyle.value as BorderLineStyle,
                    })
                  }
                >
                  <LineIcon style={lineStyle.value} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{lineStyle.title}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Slider
          className="min-w-12 flex-1"
          value={[width]}
          min={0.1}
          max={1.5}
          step={0.1}
          onPointerDown={gesture.begin}
          onValueChange={([slidingValue]) =>
            onUpdate({ [field.widthKey]: slidingValue })
          }
          onValueCommit={gesture.end}
        />
        <EditableNumber
          value={width}
          min={0.1}
          max={1.5}
          step={0.1}
          decimals={1}
          ariaLabel={`${field.label}の線の太さ`}
          widthClassName="w-8"
          onChange={(typedWidth) => onUpdate({ [field.widthKey]: typedWidth })}
        />
      </div>
      {showGap && (
        <div className="flex items-center gap-2 pl-10">
          {showDash && (
            <div className="flex flex-1 items-center gap-1.5">
              <span
                className="w-7 shrink-0 text-[9px] text-muted-foreground"
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
                onPointerDown={gesture.begin}
                onValueChange={([slidingValue]) =>
                  onUpdate({ [field.dashRatioKey]: slidingValue })
                }
                onValueCommit={gesture.end}
              />
              <EditableNumber
                value={dashRatio}
                min={0.5}
                max={10}
                step={0.5}
                decimals={1}
                ariaLabel={`${field.label}の破線の長さ`}
                widthClassName="w-8"
                onChange={(typedDashRatio) =>
                  onUpdate({ [field.dashRatioKey]: typedDashRatio })
                }
              />
            </div>
          )}
          <div className="flex flex-1 items-center gap-1.5">
            <span
              className="w-7 shrink-0 text-[9px] text-muted-foreground"
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
              onPointerDown={gesture.begin}
              onValueChange={([slidingValue]) =>
                onUpdate({ [field.gapRatioKey]: slidingValue })
              }
              onValueCommit={gesture.end}
            />
            <EditableNumber
              value={gapRatio}
              min={0.5}
              max={10}
              step={0.5}
              decimals={1}
              ariaLabel={`${field.label}の間隔`}
              widthClassName="w-8"
              onChange={(typedGapRatio) =>
                onUpdate({ [field.gapRatioKey]: typedGapRatio })
              }
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
        <span className="text-[10px] text-muted-foreground">区切り線</span>
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
        <span className="text-[10px] text-muted-foreground">番号列</span>
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
        <span className="text-[10px] text-muted-foreground">
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
