"use client"

import { useMutation } from "@tanstack/react-query"
import { AlertCircle, ListRestart } from "lucide-react"
import { useState } from "react"

import { AiModelPicker } from "@/components/common/AiModelPicker"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import type {
  ProviderModelFetchOutcome,
  ProviderModelFetchResult,
} from "@/electron-src/lib/aiGrading/providerConnectionTest"
import type { ProviderModelCatalog } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { AI_GRADING_PROVIDER_TERMS } from "@/lib/shared/aiGrading/consentText"
import { fetchAiProviderModelsMutation } from "@/queries/aiProvider"

/** 取得に失敗したときの見出し。次に何を確かめればよいかを言う */
const FAILURE_HEADLINES: Record<
  Exclude<ProviderModelFetchOutcome, "ok">,
  string
> = {
  consent_required: "この事業者への同意をし直してから取得してください",
  authentication:
    "API キーが受け付けられませんでした。キーと、事業者の契約を確かめてください",
  connection:
    "事業者へつながりませんでした。ネットワークやプロキシの設定を確かめてください",
  rate_limit:
    "利用の上限に達しています。しばらく待つか、事業者の契約の上限を確かめてください",
  unknown: "モデルの一覧を取得できませんでした",
}

/** 取得した日時を見せる形にする（端末の時刻で） */
function formatFetchedAt(fetchedAt: string): string {
  return new Date(fetchedAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface AiProviderModelDefaultsProps {
  provider: GradingProviderId
  /** キーが保存されているか（無ければ一覧を取得できない） */
  hasApiKey: boolean
  modelCatalog: ProviderModelCatalog | null
  defaultModel: string
  onDefaultModelChange: (model: string) => void
}

/**
 * 事業者ごとの「モデル一覧を取得」と既定のモデル。
 * 一覧は保存したキーで main が取得し、この端末の設定ファイルに残す
 */
export function AiProviderModelDefaults({
  provider,
  hasApiKey,
  modelCatalog,
  defaultModel,
  onDefaultModelChange,
}: AiProviderModelDefaultsProps) {
  const fetchModels = useMutation(fetchAiProviderModelsMutation())
  const [fetchResult, setFetchResult] =
    useState<ProviderModelFetchResult | null>(null)
  const providerName = AI_GRADING_PROVIDER_TERMS[provider].providerName
  const modelInputId = `ai-default-model-${provider}`

  const handleFetch = () => {
    setFetchResult(null)
    fetchModels.mutate(provider, { onSuccess: setFetchResult })
  }

  return (
    <div
      role="group"
      aria-label={`${providerName} のモデル`}
      className="space-y-2 rounded-md border p-3"
    >
      <p className="text-sm font-medium">{providerName}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasApiKey || fetchModels.isPending}
          onClick={handleFetch}
        >
          {fetchModels.isPending ? (
            <Spinner className="mr-2" />
          ) : (
            <ListRestart className="mr-2 h-4 w-4" />
          )}
          モデル一覧を取得
        </Button>
        <span
          className="text-xs text-muted-foreground"
          data-testid={`ai-model-catalog-status-${provider}`}
        >
          {!hasApiKey
            ? "API キーを保存すると取得できます"
            : modelCatalog
              ? `${formatFetchedAt(modelCatalog.fetchedAt)} に取得・${modelCatalog.models.length} 件`
              : "まだ取得していません"}
        </span>
      </div>

      {fetchResult && fetchResult.outcome !== "ok" && (
        <div
          role="status"
          className="flex items-start gap-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p>{FAILURE_HEADLINES[fetchResult.outcome]}</p>
            {fetchResult.message !== "" && (
              <p className="text-xs break-all opacity-80">
                {fetchResult.message}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={modelInputId}>既定のモデル</Label>
        <AiModelPicker
          id={modelInputId}
          provider={provider}
          catalog={modelCatalog}
          value={defaultModel}
          onValueChange={onDefaultModelChange}
          className="w-96 max-w-full"
        />
        <p className="text-xs text-muted-foreground">
          {modelCatalog
            ? "取得した一覧から選びます。一覧に無い id も、打ってそのまま使えます。"
            : provider === "anthropic"
              ? "一覧を取得するまでは、組み込みの候補から選びます。一覧に無い id も、打ってそのまま使えます。"
              : "一覧を取得するまでは、モデルの id を直接入力します。"}
        </p>
      </div>
    </div>
  )
}
