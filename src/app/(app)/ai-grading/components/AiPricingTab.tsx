"use client"

import { useQuery } from "@tanstack/react-query"

import { Spinner } from "@/components/ui/spinner"
import { myAiGradingRunsQuery } from "@/queries/aiGrading"
import { aiPricingQuery } from "@/queries/aiProvider"

import { useAiGradingSettings } from "../hooks/useAiGradingSettings"
import { AiProviderPricingSection } from "./AiProviderPricingSection"

/**
 * 「料金」タブ。費用の計算に使う単価を、利用者が事業者・モデルごとに入れる。
 *
 * **アプリは単価を持たない。** 07 の送信前の見積もり・試験の費用・使用トークンのタブは、
 * すべてここで入れた単価で計算し、単価の無いモデルは「単価未設定」として合計に入れない。
 * 単価はこの端末の設定ファイルに置く（同期しない）。
 */
export function AiPricingTab() {
  const { providerStates, settings } = useAiGradingSettings()
  const { data: pricing } = useQuery(aiPricingQuery())
  const { data: runs } = useQuery(myAiGradingRunsQuery())

  if (!pricing || !settings || !runs) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">料金</h2>
        <p className="text-sm text-muted-foreground">
          費用の計算に使う単価です。アプリは単価を持たないので、事業者の料金のページやご自身の契約を見て入れてください。
          単価の無いモデルの実行は「単価未設定」として、金額の合計に入れません。単価はこの端末にだけ保存します。
        </p>
      </div>
      {providerStates
        .filter((providerState) => providerState.isConsentCurrent)
        .map((providerState) => {
          const provider = providerState.status.provider
          return (
            <AiProviderPricingSection
              key={provider}
              provider={provider}
              pricing={pricing}
              settings={settings}
              modelCatalog={providerState.modelCatalog}
              recordedModels={[
                ...new Set(
                  runs
                    .filter((run) => run.provider === provider)
                    .map((run) => run.model)
                ),
              ]}
            />
          )
        })}
    </div>
  )
}
