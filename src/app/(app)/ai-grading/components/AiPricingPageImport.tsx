"use client"

import { useMutation } from "@tanstack/react-query"
import { AlertCircle, Download } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import type {
  AiGradingSettings,
  AiPricing,
} from "@/electron-src/lib/aiGrading/providerCredentialStore"
import {
  fetchAiPricingPageMutation,
  updateAiGradingSettingsMutation,
} from "@/queries/aiProvider"

import { parseAnthropicPricingPage } from "../utils/anthropicPricingPage"
import {
  buildPricingDraft,
  type PricingDraftRow,
} from "../utils/pricingImportDraft"
import { AiPricingDraft } from "./AiPricingDraft"

/** 読み込んだ下書き */
export interface PricingImportDraft {
  sourceUrl: string
  /** 取得した日時（ISO 8601） */
  fetchedAt: string
  rows: PricingDraftRow[]
  unmappedNames: string[]
  /** ページから読めたバッチの割合。読めなければ null（今の値のまま） */
  batchPricePercent: number | null
}

interface AiPricingPageImportProps {
  settings: AiGradingSettings
  pricing: AiPricing
  /** この端末で使う（使った・既定の・単価を入れた）モデル。新規のうち最初から選んでおく */
  modelsInUse: ReadonlySet<string>
}

/** URL の形で、https か（保存する前に画面でも確かめる。main も確かめる） */
function isHttpsUrl(text: string): boolean {
  try {
    return new URL(text).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Anthropic の料金のページから単価を読み込む。読めた値は下書きとして見せ、
 * 教員が選んで「保存」するまで単価は変わらない
 */
export function AiPricingPageImport({
  settings,
  pricing,
  modelsInUse,
}: AiPricingPageImportProps) {
  const updateSettings = useMutation(updateAiGradingSettingsMutation())
  const fetchPage = useMutation(fetchAiPricingPageMutation())
  const [draft, setDraft] = useState<PricingImportDraft | null>(null)
  const [failureReason, setFailureReason] = useState<string | null>(null)

  const saveSourceUrl = (input: HTMLInputElement) => {
    const trimmedUrl = input.value.trim()
    if (trimmedUrl === settings.anthropicPricingSourceUrl) return
    if (!isHttpsUrl(trimmedUrl)) {
      toast.error("読み込み元は https の URL にしてください")
      input.value = settings.anthropicPricingSourceUrl
      return
    }
    updateSettings.mutate({ anthropicPricingSourceUrl: trimmedUrl })
  }

  const handleFetch = () => {
    setDraft(null)
    setFailureReason(null)
    fetchPage.mutate(undefined, {
      onSuccess: (result) => {
        if (result.outcome !== "ok") {
          setFailureReason(result.message)
          return
        }
        const parsed = parseAnthropicPricingPage(result.body)
        if (!parsed.isParsed) {
          setFailureReason(parsed.reason)
          return
        }
        setDraft({
          sourceUrl: result.url,
          fetchedAt: result.fetchedAt,
          rows: buildPricingDraft(parsed.prices, pricing, modelsInUse),
          unmappedNames: parsed.unmappedNames,
          batchPricePercent: parsed.batchPricePercent,
        })
      },
      onError: (error) => setFailureReason(error.message),
    })
  }

  return (
    <div
      role="group"
      aria-label="料金のページから読み込む"
      className="space-y-3 rounded-md border p-3"
    >
      <p className="text-sm font-medium">ページから読み込む</p>
      <div className="space-y-1">
        <Label htmlFor="ai-pricing-source-url">読み込み元（https）</Label>
        <Input
          key={settings.anthropicPricingSourceUrl}
          id="ai-pricing-source-url"
          type="url"
          defaultValue={settings.anthropicPricingSourceUrl}
          onBlur={(event) => saveSourceUrl(event.target)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={fetchPage.isPending}
          onClick={handleFetch}
        >
          {fetchPage.isPending ? (
            <Spinner className="mr-2" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          ページから読み込む
        </Button>
        <span className="text-xs text-muted-foreground">
          読み込んだ値は下書きです。確かめて「保存」するまで単価は変わりません。
        </span>
      </div>

      {failureReason !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p>読み込めませんでした（手入力してください）</p>
            <p className="text-xs break-all opacity-80">{failureReason}</p>
          </div>
        </div>
      )}

      {draft && (
        <AiPricingDraft
          // 読み込み直したら下書きを作り直す
          key={draft.fetchedAt}
          draft={draft}
          currentBatchPricePercent={pricing.batchPricePercents.anthropic}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  )
}
