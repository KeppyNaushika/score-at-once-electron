import { useState } from "react"

import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"

import type { AiRunSettings } from "../types"

/**
 * 実行の設定。既定値は設定画面の既定値（事業者だけは作業場で選んでいるもの）で、
 * 利用者が変えたところだけを手元に持つ。事業者を変えたら、モデルはその事業者の既定へ戻す
 */
export function useAiRunSettings(
  settings: AiGradingSettings,
  initialProvider: GradingProviderId
) {
  const [overrides, setOverrides] = useState<Partial<AiRunSettings>>({})
  const provider = overrides.provider ?? initialProvider
  const runSettings: AiRunSettings = {
    provider,
    model: overrides.model ?? settings.defaultModels[provider],
    effort: overrides.effort ?? settings.defaultEffort,
    mode: overrides.mode ?? "realtime",
    imageScale: overrides.imageScale ?? 1,
  }
  const updateRunSettings = (update: Partial<AiRunSettings>) => {
    setOverrides((prev) =>
      update.provider !== undefined && update.provider !== prev.provider
        ? { ...prev, ...update, model: update.model }
        : { ...prev, ...update }
    )
  }
  return { runSettings, updateRunSettings }
}
