"use client"

import { useMutation } from "@tanstack/react-query"
import { type KeyboardEvent } from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type {
  GradingEffort,
  GradingProviderId,
} from "@/electron-src/lib/aiGrading/providers/types"
import { AI_GRADING_PROVIDER_TERMS } from "@/lib/shared/aiGrading/consentText"
import { updateAiGradingSettingsMutation } from "@/queries/aiProvider"

/** Anthropic で選べるモデル（設計 §3-3）。先頭が既定 */
const ANTHROPIC_MODEL_OPTIONS = [
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-4-5",
]

/** 選べる手間（main の `GRADING_EFFORTS` と同じ並び。renderer は main を値で引けない） */
const EFFORT_OPTIONS = [
  "low",
  "medium",
  "high",
] as const satisfies readonly GradingEffort[]

const EFFORT_LABELS: Record<GradingEffort, string> = {
  low: "低（速い・安い）",
  medium: "中",
  high: "高（丁寧・高い）",
}

const CONCURRENCY_MIN = 1
const CONCURRENCY_MAX = 16

/** Enter で確定する（入力欄から離れたときと同じ扱いにする） */
function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur()
}

interface AiGradingDefaultsSectionProps {
  settings: AiGradingSettings
  /** 今の利用者が今の同意をしている事業者（その事業者のモデルだけを出す） */
  consentedProviders: GradingProviderId[]
}

/** AI 採点の既定値。同意した事業者が1つでもあるときだけ出す */
export function AiGradingDefaultsSection({
  settings,
  consentedProviders,
}: AiGradingDefaultsSectionProps) {
  const updateSettings = useMutation(updateAiGradingSettingsMutation())

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

  const saveConcurrency = (input: HTMLInputElement) => {
    const concurrency = Number(input.value)
    if (
      !Number.isInteger(concurrency) ||
      concurrency < CONCURRENCY_MIN ||
      concurrency > CONCURRENCY_MAX
    ) {
      toast.error(
        `同時実行数は ${CONCURRENCY_MIN}〜${CONCURRENCY_MAX} の整数にしてください`
      )
      input.value = String(settings.concurrency)
      return
    }
    if (concurrency === settings.concurrency) return
    updateSettings.mutate({ concurrency })
  }

  const saveBudget = (input: HTMLInputElement) => {
    const trimmedValue = input.value.trim()
    if (trimmedValue === "") {
      if (settings.budgetWarningUsd !== null) {
        updateSettings.mutate({ budgetWarningUsd: null })
      }
      return
    }
    const budgetWarningUsd = Number(trimmedValue)
    if (!Number.isFinite(budgetWarningUsd) || budgetWarningUsd < 0) {
      toast.error("予算の警告額は 0 以上の数にしてください（空欄で警告しない）")
      input.value =
        settings.budgetWarningUsd === null
          ? ""
          : String(settings.budgetWarningUsd)
      return
    }
    if (budgetWarningUsd === settings.budgetWarningUsd) return
    updateSettings.mutate({ budgetWarningUsd })
  }

  return (
    <section
      aria-label="AI採点の既定値"
      className="space-y-4 rounded-lg border p-4"
    >
      <h3 className="text-base font-semibold">既定値</h3>

      {consentedProviders.map((provider) => {
        const inputId = `ai-default-model-${provider}`
        const providerName = AI_GRADING_PROVIDER_TERMS[provider].providerName
        const currentModel = settings.defaultModels[provider]
        if (provider === "anthropic") {
          const modelOptions = ANTHROPIC_MODEL_OPTIONS.includes(currentModel)
            ? ANTHROPIC_MODEL_OPTIONS
            : [currentModel, ...ANTHROPIC_MODEL_OPTIONS]
          return (
            <div key={provider} className="space-y-2">
              <Label htmlFor={inputId}>既定のモデル（{providerName}）</Label>
              <Select
                value={currentModel}
                onValueChange={(value) => saveModel(provider, value)}
              >
                <SelectTrigger id={inputId} className="w-64 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((model) => (
                    <SelectItem key={model} value={model} className="font-mono">
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        }
        return (
          <div key={provider} className="space-y-2">
            <Label htmlFor={inputId}>既定のモデル（{providerName}）</Label>
            <Input
              // 保存した値が変わったら入力欄を作り直す（他の画面での変更に追いつく）
              key={currentModel}
              id={inputId}
              defaultValue={currentModel}
              placeholder={currentModel}
              onBlur={(event) => saveModel(provider, event.target.value)}
              onKeyDown={blurOnEnter}
              className="w-64 font-mono"
            />
          </div>
        )
      })}

      <div className="space-y-2">
        <Label htmlFor="ai-default-effort">既定の推論の手間（effort）</Label>
        <Select
          value={settings.defaultEffort}
          onValueChange={(value) => {
            const effort = EFFORT_OPTIONS.find(
              (effortOption) => effortOption === value
            )
            if (effort) updateSettings.mutate({ defaultEffort: effort })
          }}
        >
          <SelectTrigger id="ai-default-effort" className="w-64">
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

      <div className="space-y-2">
        <Label htmlFor="ai-concurrency">
          同時実行数（{CONCURRENCY_MIN}〜{CONCURRENCY_MAX}）
        </Label>
        <Input
          key={settings.concurrency}
          id="ai-concurrency"
          type="number"
          min={CONCURRENCY_MIN}
          max={CONCURRENCY_MAX}
          step={1}
          defaultValue={settings.concurrency}
          onBlur={(event) => saveConcurrency(event.target)}
          onKeyDown={blurOnEnter}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          その場の採点で、同時に事業者へ送る数です。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-budget-warning">予算の警告額（米ドル・任意）</Label>
        <Input
          key={settings.budgetWarningUsd ?? "none"}
          id="ai-budget-warning"
          type="number"
          min={0}
          step="any"
          defaultValue={settings.budgetWarningUsd ?? ""}
          placeholder="警告しない"
          onBlur={(event) => saveBudget(event.target)}
          onKeyDown={blurOnEnter}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          送信前の見積もりがこの額を超えるときに警告します。空欄なら警告しません。
        </p>
      </div>
    </section>
  )
}
