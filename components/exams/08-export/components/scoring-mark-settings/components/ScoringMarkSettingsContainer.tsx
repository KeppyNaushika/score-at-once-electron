"use client"

import { Settings } from "lucide-react"

import { StatusDisplaySection } from "@/components/exams/08-export/components/scoring-mark-settings/components/StatusDisplaySection"
import {
  defaultConfig,
  defaultPartialScoreConfig,
  defaultSubtotalScoreConfig,
  defaultTotalScoreConfig,
  positionLabels,
} from "@/components/exams/08-export/components/scoring-mark-settings/constants/scoringMarkConstants"
import type {
  MarkPosition,
  ScoreTextConfig,
  ScoringMarkConfig,
  ScoringStatus,
  TextAlignment,
} from "@/components/exams/08-export/components/scoring-mark-settings/types/scoringMarkTypes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ScoringMarkSettingsContainerProps {
  config: ScoringMarkConfig
  onChange: (config: ScoringMarkConfig) => void
}

export function ScoringMarkSettingsContainer({
  config,
  onChange,
}: ScoringMarkSettingsContainerProps) {
  const partialScore: ScoreTextConfig =
    config.partialScore || defaultPartialScoreConfig
  const subtotalScore: ScoreTextConfig =
    config.subtotalScore || defaultSubtotalScoreConfig
  const totalScore: ScoreTextConfig =
    config.totalScore || defaultTotalScoreConfig
  const useSeparateSettings = config.useSeparateScoreSettings ?? false

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

  const updateAllScores = (updates: Partial<ScoreTextConfig>) => {
    updateConfig({
      partialScore: { ...partialScore, ...updates },
      summaryScore: { ...partialScore, ...updates },
      subtotalScore: { ...subtotalScore, ...updates },
      totalScore: { ...totalScore, ...updates },
    })
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

  const renderScoreSettings = (
    scoreConfig: ScoreTextConfig,
    onUpdate: (updates: Partial<ScoreTextConfig>) => void
  ) => (
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
            {(Object.keys(positionLabels) as MarkPosition[]).map((pos) => (
              <SelectItem key={pos} value={pos}>
                {positionLabels[pos]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">左右</Label>
        <Input
          type="number"
          value={scoreConfig.offsetX}
          onChange={(e) => onUpdate({ offsetX: parseInt(e.target.value) || 0 })}
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
          onChange={(e) => onUpdate({ offsetY: parseInt(e.target.value) || 0 })}
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
        useTransparent={config.useTransparent}
        onMarkStatusChange={updateMarkStatusDisplay}
        onScoreStatusChange={updateScoreStatusDisplay}
      />

      <div className="flex items-center space-x-2">
        <Checkbox
          id="use-transparent"
          checked={config.useTransparent}
          onCheckedChange={(checked) =>
            updateConfig({ useTransparent: checked as boolean })
          }
        />
        <Label htmlFor="use-transparent" className="text-sm">
          透明マークを使用
        </Label>
      </div>

      <Separator />

      {/* 採点マーク設定 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">採点マーク</Label>
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
                {(Object.keys(positionLabels) as MarkPosition[]).map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {positionLabels[pos]}
                  </SelectItem>
                ))}
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

      {/* 点数表示設定 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">点数表示</Label>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="separate-settings"
              className="text-muted-foreground text-xs"
            >
              別々に設定
            </Label>
            <Switch
              id="separate-settings"
              checked={useSeparateSettings}
              onCheckedChange={(checked) =>
                updateConfig({ useSeparateScoreSettings: checked })
              }
            />
          </div>
        </div>

        {useSeparateSettings ? (
          <Tabs defaultValue="partial" className="w-full">
            <TabsList className="grid h-8 w-full grid-cols-3">
              <TabsTrigger value="partial" className="text-xs text-red-600">
                設問部分点
              </TabsTrigger>
              <TabsTrigger value="subtotal" className="text-xs text-blue-600">
                小計点
              </TabsTrigger>
              <TabsTrigger value="total" className="text-xs text-blue-600">
                合計点
              </TabsTrigger>
            </TabsList>
            <TabsContent value="partial" className="mt-2">
              {renderScoreSettings(partialScore, updatePartialScore)}
            </TabsContent>
            <TabsContent value="subtotal" className="mt-2">
              {renderScoreSettings(subtotalScore, updateSubtotalScore)}
            </TabsContent>
            <TabsContent value="total" className="mt-2">
              {renderScoreSettings(totalScore, updateTotalScore)}
            </TabsContent>
          </Tabs>
        ) : (
          renderScoreSettings(partialScore, updateAllScores)
        )}
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
