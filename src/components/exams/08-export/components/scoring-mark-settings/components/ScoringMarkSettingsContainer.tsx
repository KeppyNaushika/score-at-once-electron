"use client"

import { Settings } from "lucide-react"

import { StatusDisplaySection } from "@/components/exams/08-export/components/scoring-mark-settings/components/StatusDisplaySection"
import {
  DEFAULT_MARK_COLOR,
  defaultConfig,
  defaultPartialScoreConfig,
  defaultSubtotalScoreConfig,
  defaultTotalScoreConfig,
  positionLabels,
  SCORE_COLOR_PRESETS,
} from "@/components/exams/08-export/components/scoring-mark-settings/constants/scoringMarkConstants"
import type {
  MarkPosition,
  ScoreTextConfig,
  ScoringMarkConfig,
  TextAlignment,
} from "@/components/exams/08-export/components/scoring-mark-settings/types"
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
import type { ScoringStatus } from "@/types/scoringStatus.types"

interface ScoringMarkSettingsContainerProps {
  config: ScoringMarkConfig
  onChange: (config: ScoringMarkConfig) => void
}

export function ScoringMarkSettingsContainer({
  config,
  onChange,
}: ScoringMarkSettingsContainerProps) {
  // 旧形式の保存データ（color/opacity未設定）でも欠落値を既定で補完する
  const partialScore: ScoreTextConfig = {
    ...defaultPartialScoreConfig,
    ...config.partialScore,
  }
  const subtotalScore: ScoreTextConfig = {
    ...defaultSubtotalScoreConfig,
    ...config.subtotalScore,
  }
  const totalScore: ScoreTextConfig = {
    ...defaultTotalScoreConfig,
    ...config.totalScore,
  }
  const markColor = config.markColor ?? DEFAULT_MARK_COLOR
  const markOpacity = config.markOpacity ?? 100

  const updateConfig = (updates: Partial<ScoringMarkConfig>) => {
    const newConfig = { ...config, ...updates }
    onChange(newConfig)
  }

  const updatePartialScore = (updates: Partial<ScoreTextConfig>) => {
    updateConfig({ partialScore: { ...partialScore, ...updates } })
  }

  const updateSubtotalScore = (updates: Partial<ScoreTextConfig>) => {
    updateConfig({ subtotalScore: { ...subtotalScore, ...updates } })
  }

  const updateTotalScore = (updates: Partial<ScoreTextConfig>) => {
    updateConfig({ totalScore: { ...totalScore, ...updates } })
  }

  const updateMarkStatusDisplay = (status: ScoringStatus, show: boolean) => {
    updateConfig({
      showMarkForStatus: { ...config.showMarkForStatus, [status]: show },
    })
  }

  const updateScoreStatusDisplay = (status: ScoringStatus, show: boolean) => {
    updateConfig({
      showScoreForStatus: { ...config.showScoreForStatus, [status]: show },
    })
  }

  const resetToDefaults = () => {
    onChange(defaultConfig)
  }

  // 見出し右側に並べる色・不透明度
  const renderColorOpacity = (
    scoreConfig: ScoreTextConfig,
    onUpdate: (updates: Partial<ScoreTextConfig>) => void
  ) => (
    <div className="flex flex-wrap items-end justify-end gap-3">
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">色</Label>
        <InlineColorPicker
          value={scoreConfig.color}
          onChange={(color) => onUpdate({ color })}
          presets={[...SCORE_COLOR_PRESETS]}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">不透明度(%)</Label>
        <Input
          type="number"
          value={scoreConfig.opacity}
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
  )

  const renderScoreSettings = (
    scoreConfig: ScoreTextConfig,
    onUpdate: (updates: Partial<ScoreTextConfig>) => void
  ) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">位置</Label>
          <Select
            value={scoreConfig.position}
            onValueChange={(v: MarkPosition) => onUpdate({ position: v })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(positionLabels) as MarkPosition[]).map(
                (position) => (
                  <SelectItem key={position} value={position}>
                    {positionLabels[position]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">左右</Label>
          <Input
            type="number"
            value={scoreConfig.offsetX}
            onChange={(e) =>
              onUpdate({ offsetX: parseInt(e.target.value) || 0 })
            }
            min={-100}
            max={100}
            className="h-9 w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">上下</Label>
          <Input
            type="number"
            value={scoreConfig.offsetY}
            onChange={(e) =>
              onUpdate({ offsetY: parseInt(e.target.value) || 0 })
            }
            min={-100}
            max={100}
            className="h-9 w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">サイズ</Label>
          <Input
            type="number"
            value={scoreConfig.size}
            onChange={(e) => onUpdate({ size: parseInt(e.target.value) || 14 })}
            min={8}
            max={200}
            className="h-9 w-full"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">配置</Label>
          <Select
            value={scoreConfig.alignment}
            onValueChange={(v: TextAlignment) => onUpdate({ alignment: v })}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">左揃え</SelectItem>
              <SelectItem value="center">中央揃え</SelectItem>
              <SelectItem value="right">右揃え</SelectItem>
            </SelectContent>
          </Select>
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
        showMarkForStatus={config.showMarkForStatus}
        showScoreForStatus={config.showScoreForStatus}
        onMarkStatusChange={updateMarkStatusDisplay}
        onScoreStatusChange={updateScoreStatusDisplay}
      />

      <Separator />

      {/* 採点マーク設定 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Label className="text-sm font-medium">採点マーク</Label>
          <div className="flex flex-wrap items-end justify-end gap-3">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">色</Label>
              <InlineColorPicker
                value={markColor}
                onChange={(color) => updateConfig({ markColor: color })}
                presets={[...SCORE_COLOR_PRESETS]}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                不透明度(%)
              </Label>
              <Input
                type="number"
                value={markOpacity}
                onChange={(e) =>
                  updateConfig({
                    markOpacity: Math.min(
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
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">位置</Label>
            <Select
              value={config.markPosition}
              onValueChange={(v: MarkPosition) =>
                updateConfig({ markPosition: v })
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(positionLabels) as MarkPosition[]).map(
                  (position) => (
                    <SelectItem key={position} value={position}>
                      {positionLabels[position]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">左右</Label>
            <Input
              type="number"
              value={config.markOffsetX}
              onChange={(e) =>
                updateConfig({ markOffsetX: parseInt(e.target.value) || 0 })
              }
              min={-100}
              max={100}
              className="h-9 w-full"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">上下</Label>
            <Input
              type="number"
              value={config.markOffsetY}
              onChange={(e) =>
                updateConfig({ markOffsetY: parseInt(e.target.value) || 0 })
              }
              min={-100}
              max={100}
              className="h-9 w-full"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">サイズ</Label>
            <Input
              type="number"
              value={config.markSize}
              onChange={(e) =>
                updateConfig({ markSize: parseInt(e.target.value) || 50 })
              }
              min={20}
              max={200}
              className="h-9 w-full"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* 設問部分点数設定 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Label className="text-sm font-medium">設問部分点数</Label>
          {renderColorOpacity(partialScore, updatePartialScore)}
        </div>
        {renderScoreSettings(partialScore, updatePartialScore)}
      </div>

      <Separator />

      {/* 小計点数設定 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Label className="text-sm font-medium">小計点数</Label>
          {renderColorOpacity(subtotalScore, updateSubtotalScore)}
        </div>
        {renderScoreSettings(subtotalScore, updateSubtotalScore)}
      </div>

      <Separator />

      {/* 合計点数設定 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Label className="text-sm font-medium">合計点数</Label>
          {renderColorOpacity(totalScore, updateTotalScore)}
        </div>
        {renderScoreSettings(totalScore, updateTotalScore)}
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={resetToDefaults}>
          デフォルトに戻す
        </Button>
      </div>
    </div>
  )
}
