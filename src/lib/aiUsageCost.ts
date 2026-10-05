/**
 * AI 採点の費用の計算（docs/vlm-grading-design.md §9・§10）。
 *
 * **単価はアプリが持たない。** 利用者が「AI採点」の画面の「料金」タブで入れた
 * 単価（`AiPricing`、端末の設定ファイル）だけで計算する。単価の無いモデル・バッチの割合の
 * 無い事業者のバッチは「単価未設定」として、金額の合計に入れない。
 *
 * 07 の送信前の見積もり・試験の費用と、「AI採点」の画面の使用トークンが使う。
 */

import type {
  AiModelPrice,
  AiPricing,
} from "@/electron-src/lib/aiGrading/providerCredentialStore"

/** 使ったトークン数（4つの欄は重ならない。`ProviderUsage` と同じ分け方） */
export interface RecordedTokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** 何も使っていない */
export const ZERO_TOKEN_USAGE: RecordedTokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
}

/** 費用を求める相手（実行の列のうち、単価を引くのに要るもの） */
export interface UsageCostTarget {
  provider: string
  model: string
  /** "realtime" | "batch" */
  mode: string
}

/** 単価が無くて金額を出せない理由 */
export type MissingPriceReason = "model_price" | "batch_percent"

/** 費用の計算の結果 */
export type UsageCost =
  | { isPriced: true; costUsd: number }
  | { isPriced: false; missing: MissingPriceReason }

/** 実行の行のうち、使用量の足し算に要るもの */
interface RunWithAttemptUsage extends RecordedTokenUsage {
  attempts: readonly RecordedTokenUsage[]
}

/** 2つの使用量を足す */
export function addTokenUsage(
  usageA: RecordedTokenUsage,
  usageB: RecordedTokenUsage
): RecordedTokenUsage {
  return {
    inputTokens: usageA.inputTokens + usageB.inputTokens,
    outputTokens: usageA.outputTokens + usageB.outputTokens,
    cacheReadTokens: usageA.cacheReadTokens + usageB.cacheReadTokens,
    cacheWriteTokens: usageA.cacheWriteTokens + usageB.cacheWriteTokens,
  }
}

/** 使用量の4つの欄の合計 */
export function totalTokenCount(usage: RecordedTokenUsage): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadTokens +
    usage.cacheWriteTokens
  )
}

/**
 * 実行1件の使用量。revise は実行の列に、grade は試行の列にある（grade の実行の列は 0 のまま）
 * ので、両方を足しても二重には数えない。消した試行の使用量は数えられない
 */
export function sumRunTokenUsage(run: RunWithAttemptUsage): RecordedTokenUsage {
  return run.attempts.reduce<RecordedTokenUsage>(
    (acc, attempt) => addTokenUsage(acc, attempt),
    {
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      cacheReadTokens: run.cacheReadTokens,
      cacheWriteTokens: run.cacheWriteTokens,
    }
  )
}

/** その事業者・モデルに入れた単価。無ければ null */
export function findModelPrice(
  pricing: AiPricing,
  provider: string,
  model: string
): AiModelPrice | null {
  return (
    pricing.modelPrices.find(
      (modelPrice) =>
        modelPrice.provider === provider && modelPrice.model === model
    ) ?? null
  )
}

/**
 * 使用量の金額の概算（米ドル）。入れた単価を欄ごとに掛け、バッチならその事業者の割合を
 * すべての欄（入力・出力・キャッシュの読み書き）に掛ける
 */
export function computeUsageCost(
  pricing: AiPricing,
  target: UsageCostTarget,
  usage: RecordedTokenUsage
): UsageCost {
  const modelPrice = findModelPrice(pricing, target.provider, target.model)
  if (!modelPrice) return { isPriced: false, missing: "model_price" }
  let priceRatio = 1
  if (target.mode === "batch") {
    // 実行の provider 列は文字列なので、割合の表を名前で引く（知らない事業者は未設定）
    const batchPricePercent =
      Object.entries(pricing.batchPricePercents).find(
        ([provider]) => provider === target.provider
      )?.[1] ?? null
    if (batchPricePercent === null) {
      return { isPriced: false, missing: "batch_percent" }
    }
    priceRatio = batchPricePercent / 100
  }
  // キャッシュへの書き込みの保持は、その場の送信が5分・バッチが1時間
  // （`electron-src/lib/aiGrading/providers/anthropicProvider.ts` が送る値）
  const cacheWritePerMillionUsd =
    target.mode === "batch"
      ? modelPrice.cacheWrite1hPerMillionUsd
      : modelPrice.cacheWrite5mPerMillionUsd
  const costPerMillion =
    usage.inputTokens * modelPrice.inputPerMillionUsd +
    usage.outputTokens * modelPrice.outputPerMillionUsd +
    usage.cacheReadTokens * modelPrice.cacheReadPerMillionUsd +
    usage.cacheWriteTokens * cacheWritePerMillionUsd
  return { isPriced: true, costUsd: (costPerMillion / 1_000_000) * priceRatio }
}

/** 単価が無くて合計に入れなかった、事業者・モデル・送り方1つぶんの使用量 */
export interface UnpricedUsage extends UsageCostTarget {
  missing: MissingPriceReason
  usage: RecordedTokenUsage
}

/** 実行の費用をまとめた結果 */
export interface RunCostSummary {
  /** 単価の分かる実行の金額の合計 */
  pricedUsd: number
  /** すべての実行の使用量の合計（単価の有無によらない） */
  usage: RecordedTokenUsage
  /** 単価が無くて合計に入れなかった使用量（最初に現れた順。使用量 0 のものは除く） */
  unpriced: UnpricedUsage[]
}

/** 実行の行のうち、費用をまとめるのに要るもの */
export type CostedRun = UsageCostTarget & RunWithAttemptUsage

/** 実行の金額を足す。単価の無い実行は金額に入れず、事業者・モデル・送り方ごとに分けて返す */
export function summarizeRunCosts(
  runs: readonly CostedRun[],
  pricing: AiPricing
): RunCostSummary {
  const unpricedByKey = new Map<string, UnpricedUsage>()
  let pricedUsd = 0
  let totalUsage = ZERO_TOKEN_USAGE
  runs.forEach((run) => {
    const usage = sumRunTokenUsage(run)
    totalUsage = addTokenUsage(totalUsage, usage)
    const cost = computeUsageCost(pricing, run, usage)
    if (cost.isPriced) {
      pricedUsd += cost.costUsd
      return
    }
    const key = JSON.stringify([run.provider, run.model, run.mode])
    const unpriced = unpricedByKey.get(key)
    unpricedByKey.set(key, {
      provider: run.provider,
      model: run.model,
      mode: run.mode,
      missing: cost.missing,
      usage: addTokenUsage(unpriced?.usage ?? ZERO_TOKEN_USAGE, usage),
    })
  })
  return {
    pricedUsd,
    usage: totalUsage,
    unpriced: [...unpricedByKey.values()].filter(
      (unpriced) => totalTokenCount(unpriced.usage) > 0
    ),
  }
}

/** 米ドルの概算を見せる形にする */
export function formatUsd(costUsd: number): string {
  if (costUsd === 0) return "$0.00"
  return costUsd < 0.01 ? "$0.01 未満" : `$${costUsd.toFixed(2)}`
}

/** 単価が無い理由の見せ方 */
export const MISSING_PRICE_LABELS: Record<MissingPriceReason, string> = {
  model_price: "単価未設定",
  batch_percent: "バッチの割合が未設定",
}

/** 「AI採点」の画面の「料金」タブへのリンク先 */
export const AI_PRICING_TAB_HREF = "/ai-grading?tab=pricing"
