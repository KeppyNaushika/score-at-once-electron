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
} from "@/types/scoringOverlay.types"
import {
  DEFAULT_ANSWER_OVERLAY_SETTINGS,
  OVERLAY_ANCHOR_LABELS,
  OVERLAY_ANCHORS,
  OVERLAY_COLOR_PRESETS,
} from "@/types/scoringOverlay.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

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
    minSize: number
  ) => (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Label className="text-sm font-medium">{title}</Label>
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
            <Label className="text-xs text-muted-foreground">不透明度(%)</Label>
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
          <Label className="text-xs text-muted-foreground">左右</Label>
          <Input
            type="number"
            value={style.offsetX}
            onChange={(e) =>
              onUpdate({ offsetX: parseInt(e.target.value) || 0 })
            }
            min={-100}
            max={100}
            className="h-9 w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">上下</Label>
          <Input
            type="number"
            value={style.offsetY}
            onChange={(e) =>
              onUpdate({ offsetY: parseInt(e.target.value) || 0 })
            }
            min={-100}
            max={100}
            className="h-9 w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">サイズ</Label>
          <Input
            type="number"
            value={style.size}
            onChange={(e) =>
              onUpdate({ size: parseInt(e.target.value) || minSize })
            }
            min={minSize}
            max={200}
            className="h-9 w-full"
          />
        </div>
      </div>
    </div>
  )

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
        20
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
        8
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
        8
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
        8
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
