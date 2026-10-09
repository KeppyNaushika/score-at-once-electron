/**
 * 2段目（項目の案）の費用の**概算**（docs/vlm-grading-design.md §3-8）。
 *
 * 2段目は1段目のあとに自動で続く、文字だけの1回の依頼である。答案の数に比例する部分
 * （答案ごとの読み取り・所見）は小さく、件数に比例しない額として1段目の概算に足す。
 *
 * - 入力は、アプリ共通の指示の目安＋プロンプトの欄の字数＋答案ごとの目安で数える
 *   （答案の数が毎回違うので、入力は実測から割り出さない）
 * - 出力（思考を含む）は、同じ事業者・モデル・手間の2段目の実測（両端を除いた平均）、
 *   無ければ手間ごとの目安
 * - 1回だけの依頼なので、キャッシュは数えない
 */

import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type {
  GradingEffort,
  GradingProviderId,
} from "@/electron-src/lib/aiGrading/providers/types"
import {
  computeUsageCost,
  type RecordedTokenUsage,
  totalTokenCount,
  type UsageCost,
} from "@/lib/aiUsageCost"

import { stripModelSnapshotDate } from "./imageTokens"
import { trimmedMean } from "./measuredUsage"

/** 2段目の指示・出力の形・節の見出しのトークン数。目安 */
const GROUPING_APP_FIXED_TOKENS = 1800

/** 答案1件ぶん（番号・仮の判定・読み取り・所見）の入力。目安 */
const GROUPING_INPUT_TOKENS_PER_ANSWER = 120

/** プロンプトの欄の文字1字あたりのトークン数の目安（日本語は1字1トークン前後） */
const TEXT_TOKENS_PER_CHARACTER = 1

/** 出力（思考を含む）の目安。答案の数によらない部分と、答案1件ごとに増える部分 */
const GROUPING_OUTPUT_BASE_TOKENS: Record<GradingEffort, number> = {
  low: 2000,
  medium: 4000,
  high: 8000,
}
const GROUPING_OUTPUT_TOKENS_PER_ANSWER = 30

/** 2段目の実行の行のうち、実測を引くのに要るもの（使用量は実行の列にある） */
interface MeasuredGroupingRun extends RecordedTokenUsage {
  purpose: string
  provider: string
  model: string
  effort: string
}

export interface GroupingCostEstimateInput {
  provider: GradingProviderId
  model: string
  effort: GradingEffort
  /** 2段目へ送る答案の数（1段目で送る件数を上限の見込みとして使う） */
  answerCount: number
  /** プロンプトの各欄（問題文・模範解答・採点基準・助言の文案の指示）と項目の一覧の字数の合計 */
  promptCharacterCount: number
  /** 自分の過去の実行（実測の根拠）。無ければ空 */
  measuredRuns: readonly MeasuredGroupingRun[]
}

type GroupingOutputBasis =
  { kind: "measured"; sampleCount: number } | { kind: "guideline" }

export interface GroupingCostEstimate {
  usage: RecordedTokenUsage
  cost: UsageCost
  outputBasis: GroupingOutputBasis
}

/** 2段目1回の概算。送る答案が無ければ（2段目を走らせないので）0 */
export function estimateGroupingCost(
  input: GroupingCostEstimateInput,
  pricing: AiPricing
): GroupingCostEstimate {
  const model = stripModelSnapshotDate(input.model)
  const samples = input.measuredRuns.filter(
    (run) =>
      run.purpose === "group" &&
      run.provider === input.provider &&
      stripModelSnapshotDate(run.model) === model &&
      run.effort === input.effort &&
      totalTokenCount(run) > 0
  )
  const measuredOutput = trimmedMean(samples.map((run) => run.outputTokens))
  const isEmpty = input.answerCount === 0
  const usage: RecordedTokenUsage = {
    inputTokens: isEmpty
      ? 0
      : GROUPING_APP_FIXED_TOKENS +
        Math.ceil(input.promptCharacterCount * TEXT_TOKENS_PER_CHARACTER) +
        GROUPING_INPUT_TOKENS_PER_ANSWER * input.answerCount,
    outputTokens: isEmpty
      ? 0
      : Math.round(
          measuredOutput ??
            GROUPING_OUTPUT_BASE_TOKENS[input.effort] +
              GROUPING_OUTPUT_TOKENS_PER_ANSWER * input.answerCount
        ),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  }
  return {
    usage,
    // 2段目は常にその場で送る（バッチの割合は掛けない）
    cost: computeUsageCost(
      pricing,
      { provider: input.provider, model: input.model, mode: "realtime" },
      usage
    ),
    outputBasis:
      measuredOutput === null
        ? { kind: "guideline" }
        : { kind: "measured", sampleCount: samples.length },
  }
}
