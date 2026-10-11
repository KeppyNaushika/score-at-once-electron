"use client"

import { Settings } from "lucide-react"

import { StatusDisplaySection } from "@/components/exams/09-export/components/scoring-mark-settings/components/StatusDisplaySection"
import { Button } from "@/components/ui/button"
import { InlineColorPicker } from "@/components/ui/color-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import type {
  AnswerOverlaySettings,
  AnswerOverlayStyle,
  OverlayAnchor,
  OverlayLengthUnit,
} from "@/types/scoringOverlay.types"
import {
  DEFAULT_ANSWER_OVERLAY_SETTINGS,
  OVERLAY_ANCHOR_LABELS,
  OVERLAY_ANCHORS,
  OVERLAY_COLOR_PRESETS,
} from "@/types/scoringOverlay.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/** 描く物の種類（サイズの下限が違う） */
type OverlayShape = "image" | "text"

/**
 * 長さの入力欄の刻みと範囲。行の単位（lengthUnit）ごとに持つ。
 *
 * "px" の行は答案画像を読めずに mm への変換が保留中の行で、その間は画素のまま編集する
 * （単位を混ぜて保存しないため。次に変換できたときに mm へ変わる）
 */
const LENGTH_INPUT_RANGES: Record<
  OverlayLengthUnit,
  {
    step: number
    offsetLimit: number
    maxSize: number
    minSize: Record<OverlayShape, number>
  }
> = {
  mm: {
    step: 0.1,
    offsetLimit: 20,
    maxSize: 40,
    minSize: { image: 3, text: 1 },
  },
  px: {
    step: 1,
    offsetLimit: 100,
    maxSize: 200,
    minSize: { image: 20, text: 8 },
  },
}

/** 入力欄に出す長さ。変換で生まれた端数は小数2桁で見せる */
const formatLength = (length: number): number => Number(length.toFixed(2))

/** 入力欄の文字列を長さへ。読めなければ fallback */
const parseLength = (text: string, fallback: number): number => {
  const length = parseFloat(text)
  return Number.isFinite(length) ? length : fallback
}

interface ScoringMarkSettingsContainerProps {
  config: AnswerOverlaySettings
  onChange: (config: AnswerOverlaySettings) => void
}

/** 9択セレクタ（位置・合わせる点の双方で使う） */
function PositionSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: OverlayAnchor
  onChange: (position: OverlayAnchor) => void
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OVERLAY_ANCHORS.map((position) => (
            <SelectItem key={position} value={position}>
              {OVERLAY_ANCHOR_LABELS[position]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ScoringMarkSettingsContainer({
  config,
  onChange,
}: ScoringMarkSettingsContainerProps) {
  const updateConfig = (updates: Partial<AnswerOverlaySettings>) => {
    onChange({ ...config, ...updates })
  }

  const updateVisibility = (
    status: ScoringStatus,
    updates: { showMark?: boolean; showScore?: boolean }
  ) => {
    updateConfig({
      visibility: {
        ...config.visibility,
        [status]: { ...config.visibility[status], ...updates },
      },
    })
  }

  const resetToDefaults = () => {
    onChange(DEFAULT_ANSWER_OVERLAY_SETTINGS)
  }

  /**
   * 採点マーク・部分点・小計・合計は同じ配置設定を持つので、
   * 1つの節として描く。差はラベルとサイズの下限だけ。
   */
  const renderStyleSection = (
    title: string,
    style: AnswerOverlayStyle,
    onUpdate: (updates: Partial<AnswerOverlayStyle>) => void,
    shape: OverlayShape
  ) => {
    const range = LENGTH_INPUT_RANGES[style.lengthUnit]
    const minSize = range.minSize[shape]
    const unitLabel = style.lengthUnit
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">{title}</Label>
            {style.lengthUnit === "px" && (
              <p className="text-xs text-muted-foreground">
                答案画像の画素で保存されています。答案画像を読み込めるようになると
                mm に変換されます
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-end justify-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">色</Label>
              <InlineColorPicker
                value={style.color}
                onChange={(color) => onUpdate({ color })}
                presets={[...OVERLAY_COLOR_PRESETS]}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                不透明度(%)
              </Label>
              <Input
                type="number"
                value={style.opacity}
                onChange={(e) =>
                  onUpdate({
                    opacity: Math.min(
                      100,
                      Math.max(0, parseInt(e.target.value) || 0)
                    ),
                  })
                }
                min={0}
                max={100}
                className="h-9 w-24"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <PositionSelect
            label="位置"
            value={style.position}
            onChange={(position) => onUpdate({ position })}
          />
          <PositionSelect
            label="合わせる点"
            value={style.anchor}
            onChange={(anchor) => onUpdate({ anchor })}
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              左右({unitLabel})
            </Label>
            <Input
              type="number"
              value={formatLength(style.offsetX)}
              onChange={(e) =>
                onUpdate({ offsetX: parseLength(e.target.value, 0) })
              }
              step={range.step}
              min={-range.offsetLimit}
              max={range.offsetLimit}
              className="h-9 w-full"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              上下({unitLabel})
            </Label>
            <Input
              type="number"
              value={formatLength(style.offsetY)}
              onChange={(e) =>
                onUpdate({ offsetY: parseLength(e.target.value, 0) })
              }
              step={range.step}
              min={-range.offsetLimit}
              max={range.offsetLimit}
              className="h-9 w-full"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              サイズ({unitLabel})
            </Label>
            <Input
              type="number"
              value={formatLength(style.size)}
              onChange={(e) => {
                const size = parseLength(e.target.value, minSize)
                onUpdate({ size: size > 0 ? size : minSize })
              }}
              step={range.step}
              min={minSize}
              max={range.maxSize}
              className="h-9 w-full"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4" />
        <Label className="text-sm font-medium">採点マーク設定</Label>
      </div>

      <StatusDisplaySection
        visibility={config.visibility}
        onMarkStatusChange={(status, show) =>
          updateVisibility(status, { showMark: show })
        }
        onScoreStatusChange={(status, show) =>
          updateVisibility(status, { showScore: show })
        }
      />

      <Separator />

      {renderStyleSection(
        "採点マーク",
        config.styles.mark,
        (updates) =>
          updateConfig({
            styles: {
              ...config.styles,
              mark: { ...config.styles.mark, ...updates },
            },
          }),
        "image"
      )}

      <Separator />

      {renderStyleSection(
        "設問部分点数",
        config.styles.partial,
        (updates) =>
          updateConfig({
            styles: {
              ...config.styles,
              partial: { ...config.styles.partial, ...updates },
            },
          }),
        "text"
      )}

      <Separator />

      {renderStyleSection(
        "小計点数",
        config.styles.subtotal,
        (updates) =>
          updateConfig({
            styles: {
              ...config.styles,
              subtotal: { ...config.styles.subtotal, ...updates },
            },
          }),
        "text"
      )}

      <Separator />

      {renderStyleSection(
        "合計点数",
        config.styles.total,
        (updates) =>
          updateConfig({
            styles: {
              ...config.styles,
              total: { ...config.styles.total, ...updates },
            },
          }),
        "text"
      )}

      <Separator />

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={resetToDefaults}>
          デフォルトに戻す
        </Button>
      </div>
    </div>
  )
}
