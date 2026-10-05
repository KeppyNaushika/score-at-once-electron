"use client"

import { useAiGradingSettings } from "@/app/(app)/ai-grading/hooks/useAiGradingSettings"
import { ExperimentalBadge } from "@/components/common/ExperimentalBadge"
import { Spinner } from "@/components/ui/spinner"

import { AiGradingSendingLimitsSection } from "./AiGradingSendingLimitsSection"
import { AiProviderSection } from "./AiProviderSection"

/**
 * 「AI採点」の画面の「設定」タブ（設計 §9）。
 *
 * 機能は同意するまで存在しないものとして扱う。このタブには入口と説明だけを置き、
 * 事業者ごとに同意した後で、キーの入力欄・接続テスト・送信の設定を出す。
 * 新しい実行やプロンプトに最初から入る値は「既定値」タブ（`AiGradingDefaultsTab`）。
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
          ご利用には、事業者ごとの同意が必要です。同意は、この端末で、ログイン中の利用者として記録されます。
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
        <AiGradingSendingLimitsSection settings={settings} />
      )}
    </div>
  )
}
