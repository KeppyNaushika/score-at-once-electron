"use client"

import { useAiGradingSettings } from "@/app/(app)/ai-grading/hooks/useAiGradingSettings"
import { Spinner } from "@/components/ui/spinner"

import { AiAnnotationInstructionDefaultSection } from "./AiAnnotationInstructionDefaultSection"
import { AiGradingDefaultsSection } from "./AiGradingDefaultsSection"

/**
 * 「AI採点」の画面の「既定値」タブ（設計 §9）。
 *
 * 新しい実行やプロンプトに最初から入る値だけを置く（実行の送信先・モデル・Effort・処理と、
 * 助言の文案の指示の既定の文言）。毎回そのまま効く設定（同時実行数・警告額など）は「設定」タブ。
 * 同意した事業者が1つでもあるときだけ開ける
 */
export function AiGradingDefaultsTab() {
  const { providerStates, settings, isLoading } = useAiGradingSettings()

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        新しく始める実行や、新しく作るプロンプトに最初から入る値です。実行やプロンプトの中で変えられます。
      </p>
      <AiGradingDefaultsSection
        settings={settings}
        consentedProviderStates={providerStates.filter(
          (providerState) => providerState.isConsentCurrent
        )}
      />
      <AiAnnotationInstructionDefaultSection settings={settings} />
    </div>
  )
}
