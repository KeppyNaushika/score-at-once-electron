/**
 * 「ページから読み込む」の読み解き（OpenAI の料金のページの Markdown）。
 *
 * **ページの本文も実際の単価も使わない。** 表は形だけを似せた作り物で、値も作り物。
 */

import { describe, expect, it } from "vitest"

import {
  openaiModelIdFromName,
  parseDollarPrice,
  parseOpenaiPricingPage,
} from "@/app/(app)/ai-grading/utils/openaiPricingPage"
import { buildPricingDraft } from "@/app/(app)/ai-grading/utils/pricingImportDraft"
import { readMajorityBatchPercent } from "@/app/(app)/ai-grading/utils/pricingPageMarkdown"
import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"

/**
 * 区分（ティア）ごとの表を、見出しの後ろに並べた作り物。列の並びは入れ替え、
 * 入力の長さで分かれる列・`-`・注記・読めない値・重複・別の区分の表を混ぜる
 */
const SYNTHETIC_PAGE = `
# Pricing

Some text before the tables.

Standard

### Standard pricing data

| Model | Long context input | Short context output | Short context input | Short context cache writes | Short context cached input | Long context output |
| --- | --- | --- | --- | --- | --- | --- |
| model-alpha-9 | $8.00 | $40.00 | $4.00 | $5.00 | $0.40 | $60.00 |
| model-beta-9.1 (<999K context length) | - | $16.00 | $2.00 | - | $0.20 | - |
| model-gamma-pro | - | $80.00 | $10.00 | - | - | - |
| Model Delta | - | $1.00 | $1.00 | - | - | - |
| model-epsilon | - | $1.00 | Free | - | - | - |
| model-alpha-9 | - | $2.00 | $2.00 | - | - | - |
| model-zeta-1 | - | $3.00 | $3.00 | - | - | - |

Batch

### Batch pricing data

| Model | Short context input | Short context cached input | Short context cache writes | Short context output |
| --- | --- | --- | --- | --- |
| model-alpha-9 | $1.00 | $0.10 | $1.25 | $10.00 |
| model-beta-9.1 (<999K context length) | $0.50 | $0.05 | - | $4.00 |
| model-gamma-pro | $2.50 | - | - | $20.00 |
| model-zeta-1 | $3.00 | - | - | $3.00 |

Flex

### Flex pricing data

| Model | Short context input | Short context cached input | Short context cache writes | Short context output |
| --- | --- | --- | --- | --- |
| model-alpha-9 | $0.01 | $0.01 | $0.01 | $0.01 |

### Grouped Pricing Table data

| Category | Model | Input | Cached input | Output |
| --- | --- | --- | --- | --- |
| Other | model-alpha-9 | $999.00 | $999.00 | $999.00 |
`

describe("OpenAI の料金のページの読み解き", () => {
  it("値・名前の部品", () => {
    expect(parseDollarPrice("$1.25")).toBe(1.25)
    expect(parseDollarPrice("$1,250.50")).toBe(1250.5)
    expect(parseDollarPrice("$1.25 / 1M characters")).toBeNull()
    expect(parseDollarPrice("Free")).toBeNull()
    expect(openaiModelIdFromName("model-beta-9.1")).toBe("model-beta-9.1")
    expect(openaiModelIdFromName("Model Delta")).toBeNull()
  })

  it("通常の区分の表を見出しで選び、短い側の列を読み、別の料金の無いキャッシュは入力と同じにする", () => {
    const parsed = parseOpenaiPricingPage(SYNTHETIC_PAGE)
    expect(parsed.isParsed).toBe(true)
    if (!parsed.isParsed) return
    expect(parsed.prices).toEqual([
      {
        displayName: "model-alpha-9",
        model: "model-alpha-9",
        inputPerMillionUsd: 4,
        outputPerMillionUsd: 40,
        cacheReadPerMillionUsd: 0.4,
        cacheWrite5mPerMillionUsd: 5,
        cacheWrite1hPerMillionUsd: 5,
      },
      {
        displayName: "model-beta-9.1",
        model: "model-beta-9.1",
        inputPerMillionUsd: 2,
        outputPerMillionUsd: 16,
        cacheReadPerMillionUsd: 0.2,
        cacheWrite5mPerMillionUsd: 2,
        cacheWrite1hPerMillionUsd: 2,
      },
      {
        displayName: "model-gamma-pro",
        model: "model-gamma-pro",
        inputPerMillionUsd: 10,
        outputPerMillionUsd: 80,
        cacheReadPerMillionUsd: 10,
        cacheWrite5mPerMillionUsd: 10,
        cacheWrite1hPerMillionUsd: 10,
      },
      {
        displayName: "model-zeta-1",
        model: "model-zeta-1",
        inputPerMillionUsd: 3,
        outputPerMillionUsd: 3,
        cacheReadPerMillionUsd: 3,
        cacheWrite5mPerMillionUsd: 3,
        cacheWrite1hPerMillionUsd: 3,
      },
    ])
    // id の形でない名前・読めない値・2度目に出た名前は推し量らずに挙げる
    expect(parsed.unmappedNames).toEqual([
      "Model Delta",
      "model-epsilon",
      "model-alpha-9",
    ])
  })

  it("バッチは多数のモデルがそろって持つ比を割合として読み、違う比のモデルを挙げる", () => {
    const parsed = parseOpenaiPricingPage(SYNTHETIC_PAGE)
    if (!parsed.isParsed) throw new Error("読めるはず")
    expect(parsed.batchPricePercent).toBeCloseTo(25)
    expect(parsed.batchExceptionNames).toEqual(["model-zeta-1"])
  })

  it("バッチの比が半分より多いモデルでそろわなければ読まない", () => {
    expect(
      readMajorityBatchPercent([
        { displayName: "model-a", ratios: [0.5, 0.5] },
        { displayName: "model-b", ratios: [0.25, 0.25] },
      ])
    ).toEqual({ batchPricePercent: null, batchExceptionNames: [] })
    // 入力と出力の比が違うモデルは、そろった比を持たない
    expect(
      readMajorityBatchPercent([
        { displayName: "model-a", ratios: [0.5, 0.5] },
        { displayName: "model-b", ratios: [0.5, 0.5] },
        { displayName: "model-c", ratios: [0.5, 0.25] },
      ])
    ).toEqual({ batchPricePercent: 50, batchExceptionNames: ["model-c"] })
  })

  it("通常の区分の表が無い（見出しが変わった・HTML が返った）ときは理由を返し、何も読まない", () => {
    expect(
      parseOpenaiPricingPage(
        SYNTHETIC_PAGE.replace("### Standard pricing data", "### Other data")
      ).isParsed
    ).toBe(false)
    expect(
      parseOpenaiPricingPage("<html><body>pricing</body></html>").isParsed
    ).toBe(false)
  })

  it("下書きは OpenAI の単価と比べる", () => {
    const parsed = parseOpenaiPricingPage(SYNTHETIC_PAGE)
    if (!parsed.isParsed) throw new Error("読めるはず")
    const pricing: AiPricing = {
      modelPrices: [
        {
          provider: "openai",
          model: "model-alpha-9",
          inputPerMillionUsd: 4,
          outputPerMillionUsd: 40,
          cacheReadPerMillionUsd: 0.4,
          cacheWrite5mPerMillionUsd: 5,
          cacheWrite1hPerMillionUsd: 5,
        },
        // 同じ id でも別の事業者の単価とは比べない
        {
          provider: "anthropic",
          model: "model-beta-9.1",
          inputPerMillionUsd: 2,
          outputPerMillionUsd: 16,
          cacheReadPerMillionUsd: 0.2,
          cacheWrite5mPerMillionUsd: 2,
          cacheWrite1hPerMillionUsd: 2,
        },
      ],
      batchPricePercents: { anthropic: null, openai: null },
    }
    expect(
      buildPricingDraft("openai", parsed.prices, pricing, new Set()).map(
        (row) => [row.pagePrice.model, row.status]
      )
    ).toEqual([
      ["model-alpha-9", "unchanged"],
      ["model-beta-9.1", "new"],
      ["model-gamma-pro", "new"],
      ["model-zeta-1", "new"],
    ])
  })
})
