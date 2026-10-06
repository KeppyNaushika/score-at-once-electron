/**
 * 07 の AI 採点の費用の概算（docs/vlm-grading-design.md §3-2）。
 *
 * ここで固定すること:
 * - 画像のトークン数は事業者・モデルごとの公式の数え方（縮小・区画・タイル）で数える
 * - 前置きは1件目が書き込み・2件目からが読み出し。最小の長さに届かなければキャッシュしない。
 *   バッチは当たりの割合（実測、無ければ目安）で分ける
 * - 実測があれば、同じプロンプト → 前置きの大きさ、同じ設問 → 同じモデル・手間の順に出力を引き、
 *   無ければ目安に戻る。どの根拠で出したかを返す
 *
 * 単価・トークン数はすべて作り物（実際の料金でも、実際の記録でもない）。
 */

import { describe, expect, it } from "vitest"

import {
  estimateRunCost,
  type RunCostEstimateInput,
} from "@/components/exams/07-score-at-once/AiGrading/utils/costEstimate"
import { countImageTokens } from "@/components/exams/07-score-at-once/AiGrading/utils/imageTokens"
import {
  type MeasuredRun,
  trimmedMean,
} from "@/components/exams/07-score-at-once/AiGrading/utils/measuredUsage"
import { minimumCacheableTokens } from "@/components/exams/07-score-at-once/AiGrading/utils/promptCachePlan"
import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { RecordedTokenUsage } from "@/lib/aiUsageCost"

describe("画像のトークン数", () => {
  it("Anthropic: 28画素の区画の数。4.7 以降は高解像度の段、それより前は標準の段の上限まで縮める", () => {
    expect(
      countImageTokens("anthropic", "claude-opus-5-5", {
        width: 1000,
        height: 1000,
      })
    ).toBe(1296)
    expect(
      countImageTokens("anthropic", "claude-opus-5-5", {
        width: 1920,
        height: 1080,
      })
    ).toBe(2691)
    expect(
      countImageTokens("anthropic", "claude-opus-5-5", {
        width: 3840,
        height: 2160,
      })
    ).toBe(4784)
    expect(
      countImageTokens("anthropic", "claude-haiku-4-5", {
        width: 1920,
        height: 1080,
      })
    ).toBe(1560)
    expect(
      countImageTokens("anthropic", "claude-haiku-4-5", {
        width: 1092,
        height: 1092,
      })
    ).toBe(1521)
    // 縦長も同じ規則（A4 を 130dpi で読んだ大きさ → 924×1307 に縮む）
    expect(
      countImageTokens("anthropic", "claude-haiku-4-5", {
        width: 1075,
        height: 1520,
      })
    ).toBe(33 * 47)
  })

  it("Anthropic: 日付付きのスナップショットは同じモデル、版の読めないモデルは高解像度の段で数える", () => {
    const image = { width: 1920, height: 1080 }
    expect(
      countImageTokens("anthropic", "claude-haiku-4-5-20251001", image)
    ).toBe(1560)
    expect(countImageTokens("anthropic", "some-future-model", image)).toBe(2691)
  })

  it("OpenAI（区画）: 32画素の区画に倍率を掛け、上限を超えれば区画の格子に合わせて縮める", () => {
    expect(
      countImageTokens("openai", "gpt-5.4", { width: 100, height: 50 })
    ).toBe(10)
    expect(
      countImageTokens("openai", "gpt-4.1-mini", { width: 100, height: 50 })
    ).toBe(13)
    // 64×64 区画 → 上限 2,500 区画の 1600×1600 に縮み、2500 × 1.2
    expect(
      countImageTokens("openai", "gpt-5.4", { width: 2048, height: 2048 })
    ).toBe(3000)
  })

  it("OpenAI（タイル）: 2048 に収め、短辺を 768 まで縮めてから 512 画素のタイルを数える", () => {
    // 1024×1024 → 768×768 → 2×2 タイル
    expect(
      countImageTokens("openai", "gpt-4o", { width: 1024, height: 1024 })
    ).toBe(85 + 170 * 4)
    expect(
      countImageTokens("openai", "gpt-5-2025-08-07", {
        width: 400,
        height: 300,
      })
    ).toBe(70 + 140)
  })
})

describe("キャッシュされる最小の長さ", () => {
  it("モデルごとの表で引き、表に無いモデルはキャッシュされにくい側とみなす", () => {
    expect(minimumCacheableTokens("anthropic", "claude-opus-5-5")).toBe(512)
    expect(
      minimumCacheableTokens("anthropic", "claude-haiku-4-5-20251001")
    ).toBe(4096)
    expect(minimumCacheableTokens("anthropic", "unknown-model")).toBe(4096)
    expect(minimumCacheableTokens("openai", "gpt-5.4")).toBe(1024)
  })
})

describe("両端を除いた平均", () => {
  it("両端の 10% ずつを除く。空なら null", () => {
    expect(trimmedMean([])).toBeNull()
    expect(trimmedMean([10, 20])).toBe(15)
    const values = [...Array.from({ length: 9 }, () => 100), 10000]
    expect(trimmedMean(values)).toBe(100)
  })
})

// 作り物の単価（100万トークンあたり）
const pricing: AiPricing = {
  modelPrices: ["claude-opus-5-5", "claude-haiku-4-5"].map((model) => ({
    provider: "anthropic",
    model,
    inputPerMillionUsd: 10,
    outputPerMillionUsd: 50,
    cacheReadPerMillionUsd: 1,
    cacheWrite5mPerMillionUsd: 20,
    cacheWrite1hPerMillionUsd: 30,
  })),
  batchPricePercents: { anthropic: 40, openai: null },
}

// 答案の画像 280×140 → 10×5 = 50 トークン ＋ 区切り 10
const ANSWER_IMAGE = { width: 280, height: 140 }
const VARIABLE_TOKENS = 60
// 模範解答の画像 560×280 → 20×10 = 200 トークン
const MODEL_ANSWER_IMAGE = { width: 560, height: 280 }
// 前置き = アプリ共通 2100 ＋ 文字 40 ＋ 画像 200
const FIXED_TOKENS = 2100 + 40 + 200

function makeInput(
  overrides: Partial<RunCostEstimateInput> = {}
): RunCostEstimateInput {
  return {
    provider: "anthropic",
    model: "claude-opus-5-5",
    effort: "medium",
    mode: "realtime",
    promptId: "prompt-a",
    cropRegionId: "question-a",
    answerImages: Array.from({ length: 4 }, () => ANSWER_IMAGE),
    fixedImages: [MODEL_ANSWER_IMAGE],
    promptCharacterCount: 40,
    measuredRuns: [],
    ...overrides,
  }
}

function makeUsage(overrides: Partial<RecordedTokenUsage>): RecordedTokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    ...overrides,
  }
}

function makeMeasuredRun(overrides: Partial<MeasuredRun>): MeasuredRun {
  return {
    purpose: "grade",
    promptId: "prompt-a",
    provider: "anthropic",
    model: "claude-opus-5-5",
    effort: "medium",
    mode: "realtime",
    prompt: { cropRegionId: "question-a" },
    attempts: [],
    ...overrides,
  }
}

describe("費用の概算（実測なし）", () => {
  it("その場の送信は、前置きを1件目で書き込み、2件目からは読み出す。出力は手間ごとの目安", () => {
    const estimate = estimateRunCost(makeInput(), pricing)
    expect(estimate.requestCount).toBe(4)
    expect(estimate.usage).toEqual({
      inputTokens: VARIABLE_TOKENS * 4,
      cacheWriteTokens: FIXED_TOKENS,
      cacheReadTokens: FIXED_TOKENS * 3,
      outputTokens: 300 * 4,
    })
    expect(estimate.basis).toEqual({
      input: { kind: "computed" },
      output: { kind: "guideline" },
      cache: { kind: "first_request_writes" },
    })
    expect(estimate.cost).toEqual({
      isPriced: true,
      costUsd: expect.closeTo(
        (VARIABLE_TOKENS * 4 * 10 +
          FIXED_TOKENS * 20 +
          FIXED_TOKENS * 3 * 1 +
          1200 * 50) /
          1_000_000
      ),
    })
  })

  it("前置きがモデルの最小の長さに届かなければ、キャッシュせず毎回入力として数える", () => {
    const estimate = estimateRunCost(
      makeInput({ model: "claude-haiku-4-5" }),
      pricing
    )
    expect(estimate.usage).toEqual({
      inputTokens: VARIABLE_TOKENS * 4 + FIXED_TOKENS * 4,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      // 思考を使わないモデルは手間によらない目安
      outputTokens: 150 * 4,
    })
    expect(estimate.basis.cache).toEqual({ kind: "not_cached" })
  })

  it("バッチは目安の割合だけ読み出し、残りを書き込み（1時間）として数え、バッチの割合を掛ける", () => {
    const estimate = estimateRunCost(
      makeInput({
        mode: "batch",
        answerImages: Array.from({ length: 10 }, () => ANSWER_IMAGE),
      }),
      pricing
    )
    expect(estimate.usage.cacheReadTokens).toBe(FIXED_TOKENS * 3)
    expect(estimate.usage.cacheWriteTokens).toBe(FIXED_TOKENS * 7)
    expect(estimate.basis.cache).toEqual({
      kind: "batch_hit_ratio",
      hitRatio: 0.3,
      sampleCount: 0,
    })
    expect(estimate.cost).toEqual({
      isPriced: true,
      costUsd: expect.closeTo(
        ((VARIABLE_TOKENS * 10 * 10 +
          FIXED_TOKENS * 7 * 30 +
          FIXED_TOKENS * 3 * 1 +
          3000 * 50) /
          1_000_000) *
          0.4
      ),
    })
  })

  it("単価の無いモデルは金額を出さない", () => {
    expect(
      estimateRunCost(makeInput({ model: "claude-opus-4-8" }), pricing).cost
    ).toEqual({ isPriced: false, missing: "model_price" })
  })
})

describe("費用の概算（実測あり）", () => {
  it("出力は同じ設問・モデル・手間の実測（両端を除いた平均）から出す", () => {
    const estimate = estimateRunCost(
      makeInput({
        measuredRuns: [
          makeMeasuredRun({
            attempts: [100, 200, 300].map((outputTokens) =>
              makeUsage({ outputTokens, inputTokens: 1 })
            ),
          }),
        ],
      }),
      pricing
    )
    expect(estimate.usage.outputTokens).toBe(200 * 4)
    expect(estimate.basis.output).toEqual({
      kind: "measured_question",
      sampleCount: 3,
    })
  })

  it("同じ設問の実測が無ければ、別の設問の同じモデル・手間の実測に緩める。手間が違えば目安に戻る", () => {
    const otherQuestionRun = makeMeasuredRun({
      promptId: "prompt-b",
      prompt: { cropRegionId: "question-b" },
      attempts: [makeUsage({ outputTokens: 500 })],
    })
    const relaxed = estimateRunCost(
      makeInput({ measuredRuns: [otherQuestionRun] }),
      pricing
    )
    expect(relaxed.usage.outputTokens).toBe(500 * 4)
    expect(relaxed.basis.output).toEqual({
      kind: "measured_model",
      sampleCount: 1,
    })

    const otherEffort = estimateRunCost(
      makeInput({ effort: "high", measuredRuns: [otherQuestionRun] }),
      pricing
    )
    expect(otherEffort.usage.outputTokens).toBe(800 * 4)
    expect(otherEffort.basis.output).toEqual({ kind: "guideline" })
  })

  it("日付付きのスナップショットの実測も同じモデルとして使い、改訂・使用量の無い試行は数えない", () => {
    const estimate = estimateRunCost(
      makeInput({
        measuredRuns: [
          makeMeasuredRun({
            model: "claude-opus-5-5-20260101",
            attempts: [makeUsage({ outputTokens: 400 }), makeUsage({})],
          }),
          makeMeasuredRun({
            purpose: "revise",
            attempts: [makeUsage({ outputTokens: 9000 })],
          }),
        ],
      }),
      pricing
    )
    expect(estimate.usage.outputTokens).toBe(400 * 4)
    expect(estimate.basis.output).toEqual({
      kind: "measured_question",
      sampleCount: 1,
    })
  })

  it("同じプロンプトの実測があれば、入力の合計から答案の画像を引いて前置きの大きさを割り出す", () => {
    const measuredFixed = 3000
    const estimate = estimateRunCost(
      makeInput({
        measuredRuns: [
          makeMeasuredRun({
            attempts: [
              makeUsage({
                inputTokens: VARIABLE_TOKENS,
                cacheWriteTokens: measuredFixed,
                outputTokens: 100,
              }),
              makeUsage({
                inputTokens: VARIABLE_TOKENS,
                cacheReadTokens: measuredFixed,
                outputTokens: 100,
              }),
            ],
          }),
        ],
      }),
      pricing
    )
    expect(estimate.usage.cacheWriteTokens).toBe(measuredFixed)
    expect(estimate.usage.cacheReadTokens).toBe(measuredFixed * 3)
    expect(estimate.basis.input).toEqual({
      kind: "measured_prompt",
      sampleCount: 2,
    })
  })

  it("同じプロンプトの実測で一度もキャッシュされていなければ、最小の長さによらずキャッシュしないとみなす", () => {
    const estimate = estimateRunCost(
      makeInput({
        measuredRuns: [
          makeMeasuredRun({
            attempts: [
              makeUsage({
                inputTokens: 2000 + VARIABLE_TOKENS,
                outputTokens: 1,
              }),
            ],
          }),
        ],
      }),
      pricing
    )
    expect(estimate.usage).toMatchObject({
      inputTokens: (2000 + VARIABLE_TOKENS) * 4,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    expect(estimate.basis.cache).toEqual({ kind: "not_cached" })
  })

  it("バッチは同じモデルのバッチの実測の当たりの割合で分ける", () => {
    const estimate = estimateRunCost(
      makeInput({
        mode: "batch",
        answerImages: Array.from({ length: 10 }, () => ANSWER_IMAGE),
        measuredRuns: [
          makeMeasuredRun({
            mode: "batch",
            promptId: "prompt-b",
            prompt: { cropRegionId: "question-b" },
            attempts: [
              makeUsage({ cacheWriteTokens: 1000 }),
              makeUsage({ cacheReadTokens: 1000 }),
              makeUsage({ cacheReadTokens: 1000 }),
              makeUsage({ cacheReadTokens: 1000 }),
            ],
          }),
        ],
      }),
      pricing
    )
    expect(estimate.basis.cache).toEqual({
      kind: "batch_hit_ratio",
      hitRatio: 0.75,
      sampleCount: 4,
    })
    // 10件のうち 8件（四捨五入）が読み出し、残り 2件が書き込み
    expect(estimate.usage.cacheReadTokens).toBe(FIXED_TOKENS * 8)
    expect(estimate.usage.cacheWriteTokens).toBe(FIXED_TOKENS * 2)
  })
})
