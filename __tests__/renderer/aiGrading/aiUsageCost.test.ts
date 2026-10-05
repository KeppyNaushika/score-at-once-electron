/**
 * AI 採点の費用の計算（利用者が入れた単価だけで計算する。アプリは単価を持たない）。
 *
 * 単価はすべて作り物。
 */

import { describe, expect, it } from "vitest"

import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import {
  computeUsageCost,
  summarizeRunCosts,
  sumRunTokenUsage,
  ZERO_TOKEN_USAGE,
} from "@/lib/aiUsageCost"

const PRICING: AiPricing = {
  modelPrices: [
    {
      provider: "anthropic",
      model: "test-model",
      inputPerMillionUsd: 2,
      outputPerMillionUsd: 10,
      cacheReadPerMillionUsd: 0.5,
      cacheWrite5mPerMillionUsd: 3,
      cacheWrite1hPerMillionUsd: 4,
    },
  ],
  batchPricePercents: { anthropic: 40, openai: null },
}

const ONE_MILLION_EACH = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cacheReadTokens: 1_000_000,
  cacheWriteTokens: 1_000_000,
}

function makeCostedRun(overrides: {
  provider?: string
  model?: string
  mode?: string
  inputTokens?: number
  attempts?: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }[]
}) {
  return {
    provider: "anthropic",
    model: "test-model",
    mode: "realtime",
    ...ZERO_TOKEN_USAGE,
    attempts: [],
    ...overrides,
  }
}

describe("使用量の金額", () => {
  it("その場の送信は、4つの欄に単価を掛け、キャッシュ書き込みは5分の単価", () => {
    expect(
      computeUsageCost(
        PRICING,
        { provider: "anthropic", model: "test-model", mode: "realtime" },
        ONE_MILLION_EACH
      )
    ).toEqual({ isPriced: true, costUsd: expect.closeTo(2 + 10 + 0.5 + 3) })
  })

  it("バッチは1時間の書き込みの単価を使い、すべての欄に事業者の割合を掛ける", () => {
    expect(
      computeUsageCost(
        PRICING,
        { provider: "anthropic", model: "test-model", mode: "batch" },
        ONE_MILLION_EACH
      )
    ).toEqual({
      isPriced: true,
      costUsd: expect.closeTo((2 + 10 + 0.5 + 4) * 0.4),
    })
  })

  it("単価の無いモデル・割合の無い事業者のバッチは金額を出さない", () => {
    expect(
      computeUsageCost(
        PRICING,
        { provider: "anthropic", model: "other-model", mode: "realtime" },
        ONE_MILLION_EACH
      )
    ).toEqual({ isPriced: false, missing: "model_price" })
    const pricingWithoutBatch: AiPricing = {
      ...PRICING,
      batchPricePercents: { anthropic: null, openai: null },
    }
    expect(
      computeUsageCost(
        pricingWithoutBatch,
        { provider: "anthropic", model: "test-model", mode: "batch" },
        ONE_MILLION_EACH
      )
    ).toEqual({ isPriced: false, missing: "batch_percent" })
    // 同じ名前のモデルでも、事業者が違えば別の単価
    expect(
      computeUsageCost(
        PRICING,
        { provider: "openai", model: "test-model", mode: "realtime" },
        ONE_MILLION_EACH
      )
    ).toEqual({ isPriced: false, missing: "model_price" })
  })
})

describe("実行の使用量と費用のまとめ", () => {
  it("改訂は実行の列、採点は試行の列を足す（二重に数えない）", () => {
    expect(
      sumRunTokenUsage(
        makeCostedRun({
          inputTokens: 100,
          attempts: [
            { ...ZERO_TOKEN_USAGE, outputTokens: 20 },
            { ...ZERO_TOKEN_USAGE, cacheReadTokens: 5, cacheWriteTokens: 7 },
          ],
        })
      )
    ).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 5,
      cacheWriteTokens: 7,
    })
  })

  it("単価のある実行だけを金額に足し、無いものはモデル・送り方ごとに分けて挙げる", () => {
    const summary = summarizeRunCosts(
      [
        makeCostedRun({ inputTokens: 1_000_000 }),
        makeCostedRun({ model: "other-model", inputTokens: 300 }),
        makeCostedRun({ model: "other-model", inputTokens: 200 }),
        makeCostedRun({ model: "empty-model" }),
      ],
      PRICING
    )
    expect(summary.pricedUsd).toBeCloseTo(2)
    expect(summary.usage.inputTokens).toBe(1_000_500)
    expect(summary.unpriced).toEqual([
      {
        provider: "anthropic",
        model: "other-model",
        mode: "realtime",
        missing: "model_price",
        usage: { ...ZERO_TOKEN_USAGE, inputTokens: 500 },
      },
    ])
  })
})
