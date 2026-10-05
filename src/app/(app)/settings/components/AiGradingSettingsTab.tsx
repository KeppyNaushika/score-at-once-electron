"use client"

import { useAiGradingSettings } from "@/app/(app)/settings/hooks/useAiGradingSettings"
import { ExperimentalBadge } from "@/components/common/ExperimentalBadge"
import { Spinner } from "@/components/ui/spinner"

import { AiGradingDefaultsSection } from "./AiGradingDefaultsSection"
import { AiProviderSection } from "./AiProviderSection"

/**
 * 「実験的機能：AI採点」タブ（設計 §9）。
 *
 * 機能は同意するまで存在しないものとして扱う。このタブには入口と説明だけを置き、
 * 事業者ごとに同意した後で、キーの入力欄・接続テスト・既定値を出す。
 * 同意は端末・利用者・同意文の版ごと（`ai-providers.json`）で、組織単位のスイッチは無い。
 */
export function AiGradingSettingsTab() {
  const { providerStates, settings, hasAnyCurrentConsent, isLoading } =
    useAiGradingSettings()

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          AI採点
          <ExperimentalBadge />
        </h2>
        <p className="text-sm text-muted-foreground">
          答案の切り出し画像を、利用者が選んだ AI
          の事業者へ送り、採点の候補を受け取る研究・実験のための機能です。AI
          の判定は候補にすぎず、教員が確かめて採用しない限り採点には入りません。
        </p>
        <p className="text-sm text-muted-foreground">
          使うには、事業者ごとに同意が要ります。同意はこの端末で、ログインしている利用者として記録します。
        </p>
      </div>

      {providerStates.map((providerState) => (
        <AiProviderSection
          key={providerState.status.provider}
          status={providerState.status}
          isConsentCurrent={providerState.isConsentCurrent}
        />
      ))}

      {hasAnyCurrentConsent && (
        <AiGradingDefaultsSection
          settings={settings}
          consentedProviderStates={providerStates.filter(
            (providerState) => providerState.isConsentCurrent
          )}
        />
      )}
    </div>
  )
}
