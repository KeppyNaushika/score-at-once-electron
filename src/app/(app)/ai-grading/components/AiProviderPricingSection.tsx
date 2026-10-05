"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { AiModelPicker } from "@/components/common/AiModelPicker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  AiGradingSettings,
  AiPricing,
  ProviderModelCatalog,
} from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { findModelPrice } from "@/lib/aiUsageCost"
import { AI_GRADING_PROVIDER_TERMS } from "@/lib/shared/aiGrading/consentText"
import { setAiBatchPricePercentMutation } from "@/queries/aiProvider"

import { PRICE_FIELD_KEYS, PRICE_FIELD_LABELS } from "../utils/modelPriceForm"
import { AiModelPriceRow } from "./AiModelPriceRow"
import { AiPricingPageImport } from "./AiPricingPageImport"

interface AiProviderPricingSectionProps {
  provider: GradingProviderId
  pricing: AiPricing
  settings: AiGradingSettings
  modelCatalog: ProviderModelCatalog | null
  /** この事業者で、記録に残っている実行が使ったモデル */
  recordedModels: readonly string[]
}

/**
 * 事業者1つ分の単価。並べるモデルは「既定のモデル・単価を入れたモデル・実行が使った
 * モデル・ここで足したモデル」で、取得した一覧の全部は並べない（足すときに選ぶ）
 */
export function AiProviderPricingSection({
  provider,
  pricing,
  settings,
  modelCatalog,
  recordedModels,
}: AiProviderPricingSectionProps) {
  const providerName = AI_GRADING_PROVIDER_TERMS[provider].providerName
  const [addedModels, setAddedModels] = useState<string[]>([])
  const setBatchPercent = useMutation(setAiBatchPricePercentMutation())
  const batchPricePercent = pricing.batchPricePercents[provider]

  const listedModels = [
    ...new Set([
      settings.defaultModels[provider],
      ...pricing.modelPrices
        .filter((modelPrice) => modelPrice.provider === provider)
        .map((modelPrice) => modelPrice.model),
      ...recordedModels,
      ...addedModels,
    ]),
  ]

  const saveBatchPercent = (input: HTMLInputElement) => {
    const trimmedValue = input.value.trim()
    const percent = trimmedValue === "" ? null : Number(trimmedValue)
    if (
      percent !== null &&
      (!Number.isFinite(percent) || percent < 0 || percent > 100)
    ) {
      toast.error("バッチの割合は 0〜100 の数にしてください（空欄で未設定）")
      input.value = batchPricePercent === null ? "" : String(batchPricePercent)
      return
    }
    if (percent === batchPricePercent) return
    setBatchPercent.mutate({ provider, percent })
  }

  return (
    <section
      aria-label={`${providerName} の単価`}
      className="space-y-4 rounded-lg border p-4"
    >
      <h3 className="text-base font-semibold">{providerName}</h3>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>モデル</TableHead>
              {PRICE_FIELD_KEYS.map((key) => (
                <TableHead key={key} className="text-right text-xs">
                  {PRICE_FIELD_LABELS[key]}
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listedModels.map((model) => {
              const modelPrice = findModelPrice(pricing, provider, model)
              return (
                <AiModelPriceRow
                  // 保存した値が変わったら欄を作り直す
                  key={`${model}:${JSON.stringify(modelPrice)}`}
                  provider={provider}
                  model={model}
                  modelPrice={modelPrice}
                />
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor={`ai-price-add-model-${provider}`}>モデルを足す</Label>
        <AiModelPicker
          id={`ai-price-add-model-${provider}`}
          provider={provider}
          catalog={modelCatalog}
          value=""
          onValueChange={(model) =>
            setAddedModels((prev) =>
              prev.includes(model) ? prev : [...prev, model]
            )
          }
          className="w-80 max-w-full"
        />
      </div>

      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        <li>
          単位はどれも 100万トークンあたりの米ドルです。入力と出力は必須です。
        </li>
        <li>
          キャッシュへの書き込みは、その場の送信が5分、バッチが1時間の保持です。
          書き込みに別の料金の無い事業者では、キャッシュの欄は空欄（0）のままにします。
        </li>
      </ul>

      <div className="space-y-2">
        <Label htmlFor={`ai-batch-percent-${provider}`}>
          バッチの単価（通常の何 %・0〜100）
        </Label>
        <Input
          key={batchPricePercent ?? "none"}
          id={`ai-batch-percent-${provider}`}
          type="number"
          min={0}
          max={100}
          step="any"
          defaultValue={batchPricePercent ?? ""}
          placeholder="未設定"
          onBlur={(event) => saveBatchPercent(event.target)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur()
          }}
          className="w-32 tabular-nums"
        />
        <p className="text-xs text-muted-foreground">
          バッチで送った実行は、入力・出力・キャッシュの読み書きのすべての単価にこの割合を掛けます。
          空欄のあいだは、バッチの実行の金額を出しません。
        </p>
      </div>

      {provider === "anthropic" && (
        <AiPricingPageImport
          settings={settings}
          pricing={pricing}
          modelsInUse={new Set(listedModels)}
        />
      )}
    </section>
  )
}
