/**
 * 「ページから読み込む」の読み解き（Anthropic の料金のページの Markdown）。
 *
 * **ページの本文も実際の単価も使わない。** 表は形だけを似せた作り物で、値も作り物。
 */

import { describe, expect, it } from "vitest"

import {
  cleanModelName,
  modelIdFromDisplayName,
  parseAnthropicPricingPage,
  parseMtokPrice,
} from "@/app/(app)/ai-grading/utils/anthropicPricingPage"
import {
  fieldsFromPrice,
  parseModelPriceFields,
} from "@/app/(app)/ai-grading/utils/modelPriceForm"
import {
  buildPricingDraft,
  type PricingDraftRow,
} from "@/app/(app)/ai-grading/utils/pricingImportDraft"
import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"

/** 列の並びを入れ替え、注記・脚注・読めない行を混ぜた作り物の表 */
const SYNTHETIC_PAGE = `
# Pricing

Some text before the table.

| Model | Output tokens | Cache hits and refreshes | Base input tokens | 1h cache writes | 5m cache writes |
| :---- | :------------ | :----------------------- | :---------------- | :-------------- | :-------------- |
| Claude Alpha 9.5 | $11 / MTok | $0.11 / MTok<sup>1</sup> | $1.10 / MTok | $2.20 / MTok | $1.375 / MTok |
| Claude Beta 9 ([retired, see notes](https://example.test/notes)) | $22 / MTok | $0.22 / MTok | $2.20 / MTok<sup>2</sup> | $4.40 / MTok | $2.75 / MTok |
| Claude Gamma 8.1 / Claude Gamma 8 | $1 / MTok | $1 / MTok | $1 / MTok | $1 / MTok | $1 / MTok |
| Claude Delta 7 | contact us | $1 / MTok | $1 / MTok | $1 / MTok | $1 / MTok |

## Other table

| Model | Something |
| ----- | --------- |
| Claude Alpha 9.5 | $999 / MTok |

## Batch

| Model | Batch input | Batch output |
| :---- | :---------- | :----------- |
| Claude Alpha 9.5 | $0.33 / MTok | $3.30 / MTok |
| Claude Beta 9 ([retired](https://example.test/notes)) | $0.66 / MTok | $6.60 / MTok |
`

describe("料金のページの読み解き", () => {
  it("値・名前の部品", () => {
    expect(parseMtokPrice("$1.25 / MTok<sup>3</sup>")).toBe(1.25)
    expect(parseMtokPrice("contact us")).toBeNull()
    expect(
      cleanModelName("Claude Beta 9 ([retired, see notes](https://x.test/a))")
    ).toBe("Claude Beta 9")
    expect(modelIdFromDisplayName("Claude Alpha 9.5")).toBe("claude-alpha-9-5")
    expect(
      modelIdFromDisplayName("Claude Gamma 8.1 / Claude Gamma 8")
    ).toBeNull()
  })

  it("見出しの文字で列を探し、読めた行を id にし、読めない名前は推し量らずに挙げる", () => {
    const parsed = parseAnthropicPricingPage(SYNTHETIC_PAGE)
    expect(parsed.isParsed).toBe(true)
    if (!parsed.isParsed) return
    expect(parsed.prices).toEqual([
      {
        displayName: "Claude Alpha 9.5",
        model: "claude-alpha-9-5",
        inputPerMillionUsd: 1.1,
        outputPerMillionUsd: 11,
        cacheReadPerMillionUsd: 0.11,
        cacheWrite5mPerMillionUsd: 1.375,
        cacheWrite1hPerMillionUsd: 2.2,
      },
      {
        displayName: "Claude Beta 9",
        model: "claude-beta-9",
        inputPerMillionUsd: 2.2,
        outputPerMillionUsd: 22,
        cacheReadPerMillionUsd: 0.22,
        cacheWrite5mPerMillionUsd: 2.75,
        cacheWrite1hPerMillionUsd: 4.4,
      },
    ])
    expect(parsed.unmappedNames).toEqual([
      "Claude Gamma 8.1 / Claude Gamma 8",
      "Claude Delta 7",
    ])
    // バッチの表がどのモデルでも同じ比（30%）なので読む
    expect(parsed.batchPricePercent).toBeCloseTo(30)
  })

  it("バッチの比がモデルでそろわなければ読まない", () => {
    const parsed = parseAnthropicPricingPage(
      SYNTHETIC_PAGE.replace("$6.60 / MTok", "$11 / MTok")
    )
    expect(parsed.isParsed && parsed.batchPricePercent).toBeNull()
  })

  it("単価の表が無い（HTML が返った等）ときは理由を返し、何も読まない", () => {
    const parsed = parseAnthropicPricingPage(
      "<html><body>pricing</body></html>"
    )
    expect(parsed.isParsed).toBe(false)
  })
})

describe("下書きと入力欄", () => {
  const pricing: AiPricing = {
    modelPrices: [
      {
        provider: "anthropic",
        model: "claude-alpha-9-5",
        inputPerMillionUsd: 1.1,
        outputPerMillionUsd: 11,
        cacheReadPerMillionUsd: 0.11,
        cacheWrite5mPerMillionUsd: 1.375,
        cacheWrite1hPerMillionUsd: 2.2,
      },
      {
        provider: "anthropic",
        model: "claude-beta-9",
        inputPerMillionUsd: 9,
        outputPerMillionUsd: 9,
        cacheReadPerMillionUsd: 9,
        cacheWrite5mPerMillionUsd: 9,
        cacheWrite1hPerMillionUsd: 9,
      },
    ],
    batchPricePercents: { anthropic: null, openai: null },
  }

  it("今の値と比べて新規・変更・同じに分け、変更と使っているモデルの新規だけを最初に選ぶ", () => {
    const parsed = parseAnthropicPricingPage(SYNTHETIC_PAGE)
    if (!parsed.isParsed) throw new Error("読めるはず")
    const extraPrice = {
      ...parsed.prices[0],
      displayName: "Claude Epsilon 1",
      model: "claude-epsilon-1",
    }
    const unusedPrice = { ...extraPrice, model: "claude-zeta-1" }
    const statusOf = (row: PricingDraftRow) => [
      row.pagePrice.model,
      row.status,
      row.isSelected,
    ]
    expect(
      buildPricingDraft(
        [...parsed.prices, extraPrice, unusedPrice],
        pricing,
        new Set(["claude-epsilon-1"])
      ).map(statusOf)
    ).toEqual([
      ["claude-alpha-9-5", "unchanged", false],
      ["claude-beta-9", "changed", true],
      ["claude-epsilon-1", "new", true],
      ["claude-zeta-1", "new", false],
    ])
  })

  it("入力と出力は必須、キャッシュの欄は空欄で 0、負の数は拒む", () => {
    const fields = {
      ...fieldsFromPrice(null),
      inputPerMillionUsd: "1",
      outputPerMillionUsd: "2.5",
    }
    expect(parseModelPriceFields("openai", " model-x ", fields)).toEqual({
      isValid: true,
      modelPrice: {
        provider: "openai",
        model: "model-x",
        inputPerMillionUsd: 1,
        outputPerMillionUsd: 2.5,
        cacheReadPerMillionUsd: 0,
        cacheWrite5mPerMillionUsd: 0,
        cacheWrite1hPerMillionUsd: 0,
      },
    })
    expect(
      parseModelPriceFields("openai", "model-x", {
        ...fields,
        outputPerMillionUsd: "",
      }).isValid
    ).toBe(false)
    expect(
      parseModelPriceFields("openai", "model-x", {
        ...fields,
        cacheReadPerMillionUsd: "-1",
      }).isValid
    ).toBe(false)
  })
})
