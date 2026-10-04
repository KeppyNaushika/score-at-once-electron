"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"

import type { AiRunSettings } from "./types"
import { AI_MODEL_OPTIONS } from "./utils/costEstimate"
import {
  EFFORT_LABELS,
  EFFORT_OPTIONS,
  IMAGE_SCALE_OPTIONS,
  providerDisplayName,
  RUN_MODE_LABELS,
  RUN_MODE_OPTIONS,
} from "./utils/runOptions"

interface AiRunSettingsFieldsProps {
  runSettings: AiRunSettings
  onRunSettingsChange: (update: Partial<AiRunSettings>) => void
  unlockedProviders: GradingProviderId[]
  /** 送り方と拡大率も選ばせるか（改訂は1往復・原寸なので選ばせない） */
  showSendingOptions: boolean
}

/** 事業者・モデル・effort（と送り方・拡大率）の選択。既定値は設定画面の既定値 */
export function AiRunSettingsFields({
  runSettings,
  onRunSettingsChange,
  unlockedProviders,
  showSendingOptions,
}: AiRunSettingsFieldsProps) {
  const modelOptions = AI_MODEL_OPTIONS[runSettings.provider]
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor="ai-run-provider">送信先</Label>
        <Select
          value={runSettings.provider}
          onValueChange={(value) => {
            const provider = unlockedProviders.find(
              (unlockedProvider) => unlockedProvider === value
            )
            if (provider) onRunSettingsChange({ provider })
          }}
        >
          <SelectTrigger id="ai-run-provider" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unlockedProviders.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {providerDisplayName(provider)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ai-run-model">モデル</Label>
        {modelOptions ? (
          <Select
            value={runSettings.model}
            onValueChange={(value) => onRunSettingsChange({ model: value })}
          >
            <SelectTrigger id="ai-run-model" className="w-full font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(modelOptions.includes(runSettings.model)
                ? modelOptions
                : [runSettings.model, ...modelOptions]
              ).map((model) => (
                <SelectItem key={model} value={model} className="font-mono">
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="ai-run-model"
            value={runSettings.model}
            onChange={(event) =>
              onRunSettingsChange({ model: event.target.value })
            }
            className="font-mono"
          />
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="ai-run-effort">推論の手間（effort）</Label>
        <Select
          value={runSettings.effort}
          onValueChange={(value) => {
            const effort = EFFORT_OPTIONS.find(
              (effortOption) => effortOption === value
            )
            if (effort) onRunSettingsChange({ effort })
          }}
        >
          <SelectTrigger id="ai-run-effort" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EFFORT_OPTIONS.map((effort) => (
              <SelectItem key={effort} value={effort}>
                {EFFORT_LABELS[effort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showSendingOptions && (
        <>
          <div className="space-y-1">
            <Label htmlFor="ai-run-mode">送り方</Label>
            <Select
              value={runSettings.mode}
              onValueChange={(value) => {
                const mode = RUN_MODE_OPTIONS.find(
                  (modeOption) => modeOption === value
                )
                if (mode) onRunSettingsChange({ mode })
              }}
            >
              <SelectTrigger id="ai-run-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RUN_MODE_OPTIONS.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {RUN_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ai-run-image-scale">送る画像の拡大率</Label>
            <Select
              value={String(runSettings.imageScale)}
              onValueChange={(value) => {
                const imageScale = IMAGE_SCALE_OPTIONS.find(
                  (scaleOption) => String(scaleOption) === value
                )
                if (imageScale) onRunSettingsChange({ imageScale })
              }}
            >
              <SelectTrigger id="ai-run-image-scale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_SCALE_OPTIONS.map((imageScale) => (
                  <SelectItem key={imageScale} value={String(imageScale)}>
                    {imageScale === 1 ? "原寸（推奨）" : `${imageScale} 倍`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  )
}
