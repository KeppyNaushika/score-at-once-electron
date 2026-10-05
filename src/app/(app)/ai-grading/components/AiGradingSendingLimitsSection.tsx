"use client"

import { useMutation } from "@tanstack/react-query"
import { type KeyboardEvent } from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { updateAiGradingSettingsMutation } from "@/queries/aiProvider"

const CONCURRENCY_MIN = 1
const CONCURRENCY_MAX = 16

/** Enter で確定する（入力欄から離れたときと同じ扱いにする） */
function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur()
}

interface AiGradingSendingLimitsSectionProps {
  settings: AiGradingSettings
}

/**
 * 送信の同時実行数と、送信1回の見積もりの警告額。「設定」タブに置く。
 * どちらも実行やプロンプトに最初から入る値（既定値）ではなく、毎回そのまま効く設定
 */
export function AiGradingSendingLimitsSection({
  settings,
}: AiGradingSendingLimitsSectionProps) {
  const updateSettings = useMutation(updateAiGradingSettingsMutation())

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
      toast.error("警告額は 0 以上の数にしてください（空欄で警告しない）")
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
      aria-label="AI採点の送信"
      className="space-y-4 rounded-lg border p-4"
    >
      <h3 className="text-base font-semibold">送信</h3>

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
          「すぐに」の処理で、同時に事業者へ送る数です。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-budget-warning">
          送信1回の見積もりの警告額（米ドル・任意）
        </Label>
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
          送信の前に、その1回の見積もりがこの額を超えるときに警告します（月の予算ではありません）。空欄なら警告しません。
        </p>
      </div>
    </section>
  )
}
