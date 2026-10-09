/**
 * 採点の実行の費用の**概算**（docs/vlm-grading-design.md §3-2・§9-3）。
 *
 * main は送る画像の大きさ（画素）と実行の生の行だけを返し、トークン数と金額はここで求める。
 * 単価はアプリが持たず、利用者が入れた単価（`AiPricing`）で `src/lib/aiUsageCost.ts` が金額にする。
 *
 * 1件の依頼は「固定部（アプリ共通の指示・出力の形・問題文・模範解答・固定の画像）＋答案の画像」。
 * - 答案の画像は、事業者・モデルごとの数え方で画素から数える（`imageTokens.ts`）
 * - 固定部は、同じプロンプトで送った実測があればそこから割り出し、無ければ目安で数える
 * - 出力は、同じ設問 → 同じモデル・手間の実測の順に探し、無ければ目安に戻る
 * - キャッシュは固定部だけに効く。読み出し・書き込みの件数の分け方は `promptCachePlan.ts`
 *
 * 実測の当たりの割合（読み出し / 書き込み）を1件あたりの平均としてそのまま使わないのは、
 * それが1回の実行の件数で変わる（書き込みは実行に1件）からである。実測から取るのは量
 * （固定部の大きさ・1件あたりの出力・キャッシュされたか）で、読み書きの分け方は送り方の
 * 仕組みから決める。バッチだけは仕組みで決まらないので、当たりの割合を実測から取る。
 */

import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type {
  GradingEffort,
  GradingProviderId,
} from "@/electron-src/lib/aiGrading/providers/types"
import {
  computeUsageCost,
  type RecordedTokenUsage,
  type UsageCost,
} from "@/lib/aiUsageCost"
import { supportsAdaptiveThinking } from "@/lib/shared/aiGrading/modelFeatures"
import type { AiGradingRunMode } from "@/types/aiGrading.types"

import { countImageTokens, type ImageSize } from "./imageTokens"
import {
  collectMeasuredAttempts,
  type MeasuredRun,
  totalInputTokens,
  trimmedMean,
} from "./measuredUsage"
import {
  type CacheBasis,
  minimumCacheableTokens,
  planPromptCache,
} from "./promptCachePlan"

/**
 * 固定部のうち、プロンプトの欄以外（アプリ共通の指示・出力の形・節の見出し）のトークン数。
 * 集計に基づく目安
 */
const APP_FIXED_TOKENS = 2100

/** プロンプトの欄の文字1字あたりのトークン数の目安（日本語は1字1トークン前後） */
const TEXT_TOKENS_PER_CHARACTER = 1

/** 答案1件ごとに画像のほかにかかる入力（区切りなど）。集計に基づく目安 */
const VARIABLE_PART_OVERHEAD_TOKENS = 10

/**
 * 答案1件あたりの出力（思考を含む）のトークン数の目安。low・medium は集計に基づく目安、
 * high は集計が無いため多めに置いた目安
 */
const OUTPUT_TOKENS_PER_ANSWER: Record<GradingEffort, number> = {
  low: 150,
  medium: 300,
  high: 800,
}

/** 思考を使わないモデル（手間を送らない）の、答案1件あたりの出力の目安。集計に基づく目安 */
const OUTPUT_TOKENS_PER_ANSWER_WITHOUT_THINKING = 150

export interface RunCostEstimateInput {
  provider: GradingProviderId
  model: string
  effort: GradingEffort
  mode: AiGradingRunMode
  promptId: string
  cropRegionId: string
  /** 送る答案画像の大きさ（答案1件に1枚） */
  answerImages: readonly ImageSize[]
  /** 毎回いっしょに送る画像（問題用紙・模範解答の切り出し） */
  fixedImages: readonly ImageSize[]
  /** プロンプトの各欄（問題文・模範解答・採点基準・助言の文案の指示）の字数の合計 */
  promptCharacterCount: number
  /** 自分の過去の実行（実測の根拠）。無ければ空 */
  measuredRuns: readonly MeasuredRun[]
}

/** 固定部の大きさの根拠 */
export type InputBasis =
  { kind: "measured_prompt"; sampleCount: number } | { kind: "computed" }

/** 出力の根拠 */
export type OutputBasis =
  | { kind: "measured_question"; sampleCount: number }
  | { kind: "measured_model"; sampleCount: number }
  | { kind: "guideline" }

export interface RunCostEstimate {
  requestCount: number
  usage: RecordedTokenUsage
  /** 利用者が入れた単価での金額。単価が無ければ金額を出さない */
  cost: UsageCost
  basis: { input: InputBasis; output: OutputBasis; cache: CacheBasis }
}

function estimateFixedTokens(
  input: RunCostEstimateInput,
  variableMean: number
) {
  const samples = collectMeasuredAttempts(input.measuredRuns, {
    provider: input.provider,
    model: input.model,
    promptId: input.promptId,
  })
  const measuredInput = trimmedMean(samples.map(totalInputTokens))
  if (measuredInput !== null) {
    return {
      fixedTokens: Math.max(0, Math.round(measuredInput - variableMean)),
      // 同じプロンプトなら固定部は同じなので、実際にキャッシュされたかで決まる
      measuredCached: samples.some(
        (sample) => sample.cacheReadTokens + sample.cacheWriteTokens > 0
      ),
      basis: {
        kind: "measured_prompt",
        sampleCount: samples.length,
      } satisfies InputBasis,
    }
  }
  const fixedTokens =
    APP_FIXED_TOKENS +
    Math.ceil(input.promptCharacterCount * TEXT_TOKENS_PER_CHARACTER) +
    input.fixedImages.reduce(
      (acc, image) =>
        acc + countImageTokens(input.provider, input.model, image),
      0
    )
  return {
    fixedTokens,
    measuredCached: null,
    basis: { kind: "computed" } satisfies InputBasis,
  }
}

function estimateOutputPerAnswer(input: RunCostEstimateInput): {
  outputPerAnswer: number
  basis: OutputBasis
} {
  const conditions = [
    {
      kind: "measured_question" as const,
      condition: { cropRegionId: input.cropRegionId },
    },
    { kind: "measured_model" as const, condition: {} },
  ]
  for (const { kind, condition } of conditions) {
    const samples = collectMeasuredAttempts(input.measuredRuns, {
      provider: input.provider,
      model: input.model,
      effort: input.effort,
      ...condition,
    })
    const measuredOutput = trimmedMean(
      samples.map((sample) => sample.outputTokens)
    )
    if (measuredOutput !== null) {
      return {
        outputPerAnswer: measuredOutput,
        basis: { kind, sampleCount: samples.length },
      }
    }
  }
  const usesThinking =
    input.provider !== "anthropic" || supportsAdaptiveThinking(input.model)
  return {
    outputPerAnswer: usesThinking
      ? OUTPUT_TOKENS_PER_ANSWER[input.effort]
      : OUTPUT_TOKENS_PER_ANSWER_WITHOUT_THINKING,
    basis: { kind: "guideline" },
  }
}

/** 実行1回の概算。答案1件ごとに「固定部＋答案の画像」を1回送るとして数える */
export function estimateRunCost(
  input: RunCostEstimateInput,
  pricing: AiPricing
): RunCostEstimate {
  const requestCount = input.answerImages.length
  const variableTokens = input.answerImages.map(
    (image) =>
      countImageTokens(input.provider, input.model, image) +
      VARIABLE_PART_OVERHEAD_TOKENS
  )
  const variableTotal = variableTokens.reduce((acc, tokens) => acc + tokens, 0)
  const variableMean = requestCount === 0 ? 0 : variableTotal / requestCount

  const fixed = estimateFixedTokens(input, variableMean)
  const isCached =
    fixed.measuredCached ??
    fixed.fixedTokens >= minimumCacheableTokens(input.provider, input.model)
  const cachePlan = planPromptCache(input, requestCount, isCached)
  const uncachedRequestCount =
    requestCount - cachePlan.readCount - cachePlan.writeCount
  const output = estimateOutputPerAnswer(input)

  const usage: RecordedTokenUsage = {
    inputTokens: variableTotal + fixed.fixedTokens * uncachedRequestCount,
    outputTokens: Math.round(output.outputPerAnswer * requestCount),
    cacheReadTokens: fixed.fixedTokens * cachePlan.readCount,
    cacheWriteTokens: fixed.fixedTokens * cachePlan.writeCount,
  }
  const cost = computeUsageCost(
    pricing,
    { provider: input.provider, model: input.model, mode: input.mode },
    usage
  )
  return {
    requestCount,
    usage,
    cost,
    basis: { input: fixed.basis, output: output.basis, cache: cachePlan.basis },
  }
}
