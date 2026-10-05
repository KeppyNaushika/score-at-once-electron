"use client"

import { useMutation } from "@tanstack/react-query"

import type { useAiGradingSettings } from "@/app/(app)/ai-grading/hooks/useAiGradingSettings"
import { AiRunOptionToggles } from "@/components/common/AiRunOptionToggles"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { AI_GRADING_PROVIDER_TERMS } from "@/lib/shared/aiGrading/consentText"
import {
  acceptsEffort,
  PROVIDER_SUPPORTS_BATCH,
} from "@/lib/shared/aiGrading/modelFeatures"
import { updateAiGradingSettingsMutation } from "@/queries/aiProvider"

import { AiProviderModelDefaults } from "./AiProviderModelDefaults"

interface AiGradingDefaultsSectionProps {
  settings: AiGradingSettings
  /** 今の利用者が今の同意をしている事業者の状態（その事業者のモデルだけを出す） */
  consentedProviderStates: ReturnType<
    typeof useAiGradingSettings
  >["providerStates"]
}

/**
 * AI 採点の実行の既定値（送信先・モデル・Effort・処理）。「既定値」タブに置く。
 * 07 の実行のダイアログは、開いたときにここの値を選んだ状態から始まる
 */
export function AiGradingDefaultsSection({
  settings,
  consentedProviderStates,
}: AiGradingDefaultsSectionProps) {
  const updateSettings = useMutation(updateAiGradingSettingsMutation())
  /** 送信先に選べる事業者（今の同意があり、キーも保存されている） */
  const unlockedProviders = consentedProviderStates
    .filter((providerState) => providerState.isUnlocked)
    .map((providerState) => providerState.status.provider)
  /** 既定の送信先の、取得しておいたモデルの一覧（Effort を選べるかの判断に使う） */
  const defaultProviderCatalog =
    consentedProviderStates.find(
      (providerState) =>
        providerState.status.provider === settings.defaultProvider
    )?.modelCatalog ?? null

  const saveModel = (provider: GradingProviderId, model: string) => {
    const trimmedModel = model.trim()
    if (
      trimmedModel === "" ||
      trimmedModel === settings.defaultModels[provider]
    )
      return
    updateSettings.mutate({
      defaultModels: { ...settings.defaultModels, [provider]: trimmedModel },
    })
  }

  return (
    <section
      aria-label="AI採点の既定値"
      className="space-y-4 rounded-lg border p-4"
    >
      <h3 className="text-base font-semibold">実行の既定値</h3>

      <div className="space-y-2">
        <Label htmlFor="ai-default-provider">既定の送信先</Label>
        {unlockedProviders.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            API キーを保存した事業者がまだありません。
          </p>
        ) : (
          <Select
            value={
              unlockedProviders.includes(settings.defaultProvider)
                ? settings.defaultProvider
                : ""
            }
            onValueChange={(value) => {
              const provider = unlockedProviders.find(
                (unlockedProvider) => unlockedProvider === value
              )
              if (provider && provider !== settings.defaultProvider) {
                updateSettings.mutate({ defaultProvider: provider })
              }
            }}
          >
            <SelectTrigger id="ai-default-provider" className="w-64">
              <SelectValue placeholder="送信先を選ぶ" />
            </SelectTrigger>
            <SelectContent>
              {unlockedProviders.map((provider) => (
                <SelectItem key={provider} value={provider}>
                  {AI_GRADING_PROVIDER_TERMS[provider].providerName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {consentedProviderStates.map((providerState) => (
        <AiProviderModelDefaults
          key={providerState.status.provider}
          provider={providerState.status.provider}
          hasApiKey={providerState.status.hasApiKey}
          modelCatalog={providerState.modelCatalog}
          defaultModel={settings.defaultModels[providerState.status.provider]}
          onDefaultModelChange={(model) =>
            saveModel(providerState.status.provider, model)
          }
        />
      ))}

      <div className="max-w-xl">
        <AiRunOptionToggles
          idPrefix="ai-default"
          effort={settings.defaultEffort}
          onEffortChange={(effort) => {
            if (effort !== settings.defaultEffort) {
              updateSettings.mutate({ defaultEffort: effort })
            }
          }}
          isEffortDisabled={
            !acceptsEffort(
              settings.defaultProvider,
              settings.defaultModels[settings.defaultProvider],
              defaultProviderCatalog?.models ?? []
            )
          }
          sendingOptions={{
            mode: settings.defaultMode,
            onModeChange: (mode) => {
              if (mode !== settings.defaultMode) {
                updateSettings.mutate({ defaultMode: mode })
              }
            },
            isBatchAvailable: PROVIDER_SUPPORTS_BATCH[settings.defaultProvider],
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Effort と処理は、既定の送信先の既定のモデルで選べるものを示しています。
        バッチは費用が下がることがありますが（割合は「料金」タブで入れます）、結果まで最大1日かかります。拡大率は原寸を推奨します（拡大しても情報は増えず、費用が増えるだけです）。
      </p>
    </section>
  )
}
