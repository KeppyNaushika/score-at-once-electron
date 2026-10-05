"use client"

import { useQuery } from "@tanstack/react-query"

import { AiModelPicker } from "@/components/common/AiModelPicker"
import { AiRunOptionToggles } from "@/components/common/AiRunOptionToggles"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import {
  acceptsEffort,
  PROVIDER_SUPPORTS_BATCH,
} from "@/lib/shared/aiGrading/modelFeatures"
import { aiModelCatalogsQuery } from "@/queries/aiProvider"

import type { AiRunSettings } from "./types"
import { providerDisplayName } from "./utils/runOptions"

interface AiRunSettingsFieldsProps {
  runSettings: AiRunSettings
  onRunSettingsChange: (update: Partial<AiRunSettings>) => void
  unlockedProviders: GradingProviderId[]
  /** 送り方と拡大率も選ばせるか（改訂は1往復・原寸なので選ばせない） */
  showSendingOptions: boolean
}

/**
 * 事業者・モデル・手間（と送り方・拡大率）の選択。既定値は「AI採点」の画面の既定値。
 * 手間はモデルが受け付けないとき、バッチは事業者が送れないときに選ばせない
 */
export function AiRunSettingsFields({
  runSettings,
  onRunSettingsChange,
  unlockedProviders,
  showSendingOptions,
}: AiRunSettingsFieldsProps) {
  // 取得しておいた一覧が無ければ（読めなくても）組み込みの一覧・自由入力で選ばせる
  const { data: modelCatalogs } = useQuery(aiModelCatalogsQuery())
  const catalog = modelCatalogs?.[runSettings.provider] ?? null
  const isBatchAvailable = PROVIDER_SUPPORTS_BATCH[runSettings.provider]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ai-run-provider">送信先</Label>
          <Select
            value={runSettings.provider}
            onValueChange={(value) => {
              const provider = unlockedProviders.find(
                (unlockedProvider) => unlockedProvider === value
              )
              if (!provider) return
              // バッチで送れない事業者へ移ったら、その場へ戻す
              onRunSettingsChange(
                PROVIDER_SUPPORTS_BATCH[provider]
                  ? { provider }
                  : { provider, mode: "realtime" }
              )
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
          <AiModelPicker
            // 事業者を変えたら作り直す（打ちかけの id を別の事業者へ持ち越さない）
            key={runSettings.provider}
            id="ai-run-model"
            provider={runSettings.provider}
            catalog={catalog}
            value={runSettings.model}
            onValueChange={(model) => onRunSettingsChange({ model })}
            className="w-full"
          />
        </div>
      </div>

      <AiRunOptionToggles
        idPrefix="ai-run"
        effort={runSettings.effort}
        onEffortChange={(effort) => onRunSettingsChange({ effort })}
        isEffortDisabled={
          !acceptsEffort(
            runSettings.provider,
            runSettings.model,
            catalog?.models ?? []
          )
        }
        sendingOptions={
          showSendingOptions
            ? {
                mode: runSettings.mode,
                onModeChange: (mode) => onRunSettingsChange({ mode }),
                isBatchAvailable,
              }
            : null
        }
      />
    </div>
  )
}
