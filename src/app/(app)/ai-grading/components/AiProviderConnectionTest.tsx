"use client"

import { useMutation } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, PlugZap } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type {
  ProviderConnectionTestOutcome,
  ProviderConnectionTestResult,
} from "@/electron-src/lib/aiGrading/providerConnectionTest"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { useInFlightGuard } from "@/hooks/useInFlightGuard"
import { testAiProviderConnectionMutation } from "@/queries/aiProvider"

/** 結果の種類ごとの見出し。次に何を確かめればよいかを言う */
const OUTCOME_HEADLINES: Record<ProviderConnectionTestOutcome, string> = {
  ok: "接続できました",
  authentication:
    "API キーが受け付けられませんでした。キーと、事業者の契約を確かめてください",
  connection:
    "事業者へつながりませんでした。ネットワークやプロキシの設定を確かめてください",
  rate_limit:
    "利用の上限に達しています。しばらく待つか、事業者の契約の上限を確かめてください",
  unknown: "接続を確かめられませんでした",
}

interface AiProviderConnectionTestProps {
  provider: GradingProviderId
  hasApiKey: boolean
}

/** 保存したキーで事業者へつながるか試す（トークンを消費しない呼び出しを使う） */
export function AiProviderConnectionTest({
  provider,
  hasApiKey,
}: AiProviderConnectionTestProps) {
  const testConnection = useMutation(testAiProviderConnectionMutation())
  // ダブルクリックでも外部への取得を1回に限る
  const testGuard = useInFlightGuard()
  const [testResult, setTestResult] =
    useState<ProviderConnectionTestResult | null>(null)

  const handleTest = () => {
    if (!testGuard.tryAcquire()) return
    setTestResult(null)
    testConnection.mutate(provider, {
      onSuccess: setTestResult,
      onSettled: testGuard.release,
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={!hasApiKey || testConnection.isPending}
          onClick={handleTest}
        >
          {testConnection.isPending ? (
            <Spinner className="mr-2" />
          ) : (
            <PlugZap className="mr-2 h-4 w-4" />
          )}
          接続テスト
        </Button>
        {!hasApiKey && (
          <span className="text-xs text-muted-foreground">
            API キーを保存すると試せます
          </span>
        )}
      </div>
      {testResult && (
        <div
          role="status"
          className={
            testResult.outcome === "ok"
              ? "flex items-start gap-2 text-sm text-green-700"
              : "flex items-start gap-2 text-sm text-red-700"
          }
        >
          {testResult.outcome === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="space-y-0.5">
            <p>{OUTCOME_HEADLINES[testResult.outcome]}</p>
            {testResult.message !== "" && (
              <p className="text-xs break-all opacity-80">
                {testResult.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
