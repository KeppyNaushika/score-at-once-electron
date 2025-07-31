"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Settings } from "lucide-react"
import { StatusDisplaySection } from "@/components/projects/08-export/components/scoring-mark-settings/components/StatusDisplaySection"
import { PositionSettingsSection } from "@/components/projects/08-export/components/scoring-mark-settings/components/PositionSettingsSection"
import { OffsetSettingsSection } from "@/components/projects/08-export/components/scoring-mark-settings/components/OffsetSettingsSection"
import { SizeSettingsSection } from "@/components/projects/08-export/components/scoring-mark-settings/components/SizeSettingsSection"
import { TextAlignmentSection } from "@/components/projects/08-export/components/scoring-mark-settings/components/TextAlignmentSection"
import type {
  MarkPosition,
  ScoringMarkConfig,
  ScoringStatus,
  TextAlignment,
} from "@/components/projects/08-export/components/scoring-mark-settings/types/scoring-mark-types"
import {
  defaultConfig,
} from "@/components/projects/08-export/components/scoring-mark-settings/constants/scoring-mark-constants"
import { saveConfigToStorage } from "@/components/projects/08-export/components/scoring-mark-settings/utils/scoring-mark-utils"

interface ScoringMarkSettingsContainerProps {
  config: ScoringMarkConfig
  onChange: (config: ScoringMarkConfig) => void
}

export function ScoringMarkSettingsContainer({
  config,
  onChange,
}: ScoringMarkSettingsContainerProps) {
  const updateConfig = (updates: Partial<ScoringMarkConfig>) => {
    const newConfig = { ...config, ...updates }
    onChange(newConfig)
    saveConfigToStorage(newConfig)
  }

  const updateMarkStatusDisplay = (status: ScoringStatus, show: boolean) => {
    updateConfig({
      showMarkForStatus: {
        ...config.showMarkForStatus,
        [status]: show,
      },
    })
  }

  const updateScoreStatusDisplay = (status: ScoringStatus, show: boolean) => {
    updateConfig({
      showScoreForStatus: {
        ...config.showScoreForStatus,
        [status]: show,
      },
    })
  }

  const resetToDefaults = () => {
    onChange(defaultConfig)
    saveConfigToStorage(defaultConfig)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5" />
        <Label className="text-base font-medium">採点マーク設定</Label>
      </div>

      {/* 採点マークと点数の表示対象を左右対称に配置 */}
      <StatusDisplaySection
        showMarkForStatus={config.showMarkForStatus}
        showScoreForStatus={config.showScoreForStatus}
        useTransparent={config.useTransparent}
        onMarkStatusChange={updateMarkStatusDisplay}
        onScoreStatusChange={updateScoreStatusDisplay}
      />

      {/* 透明度設定 */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="use-transparent"
          checked={config.useTransparent}
          onCheckedChange={(checked) =>
            updateConfig({ useTransparent: checked as boolean })
          }
        />
        <Label htmlFor="use-transparent" className="text-sm font-medium">
          透明マークを使用
        </Label>
      </div>

      {/* 位置設定を左右対称に配置 */}
      <PositionSettingsSection
        markPosition={config.markPosition}
        scorePosition={config.scorePosition}
        onMarkPositionChange={(position: MarkPosition) =>
          updateConfig({ markPosition: position })
        }
        onScorePositionChange={(position: MarkPosition) =>
          updateConfig({ scorePosition: position })
        }
      />

      {/* オフセット設定を左右対称に配置 */}
      <OffsetSettingsSection
        markOffsetX={config.markOffsetX}
        markOffsetY={config.markOffsetY}
        scoreOffsetX={config.scoreOffsetX}
        scoreOffsetY={config.scoreOffsetY}
        onMarkOffsetXChange={(value) => updateConfig({ markOffsetX: value })}
        onMarkOffsetYChange={(value) => updateConfig({ markOffsetY: value })}
        onScoreOffsetXChange={(value) => updateConfig({ scoreOffsetX: value })}
        onScoreOffsetYChange={(value) => updateConfig({ scoreOffsetY: value })}
      />

      {/* サイズ設定を左右対称に配置 */}
      <SizeSettingsSection
        markSize={config.markSize}
        scoreSize={config.scoreSize}
        onMarkSizeChange={(size) => updateConfig({ markSize: size })}
        onScoreSizeChange={(size) => updateConfig({ scoreSize: size })}
      />

      {/* テキスト配置設定を追加 */}
      <TextAlignmentSection
        scoreAlignment={config.scoreAlignment}
        onScoreAlignmentChange={(alignment: TextAlignment) =>
          updateConfig({ scoreAlignment: alignment })
        }
      />

      {/* リセットボタン */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={resetToDefaults}>
          デフォルトに戻す
        </Button>
      </div>
    </div>
  )
}
