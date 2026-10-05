/**
 * 採点の実行の費用の**概算**（docs/vlm-grading-design.md §3-2・§10）。
 *
 * main は送る画像の大きさ（画素）だけを返し、トークン数と金額はここで求める。
 * 実際の請求は事業者の計算（思考のトークン・キャッシュの効き）で決まるので、
 * 画面には必ず「概算」と添える。単価はこのファイルにだけ置く。
 */

import type { GradingEffort } from "@/electron-src/lib/aiGrading/providers/types"
import type { AiGradingRunMode } from "@/types/aiGrading.types"

/** モデルの単価（100万トークンあたりの米ドル） */
interface ModelPrice {
  inputPerMillionUsd: number
  outputPerMillionUsd: number
}

/**
 * 単価の分かっているモデル。ここに無いモデル（取得した一覧から選んだ新しいモデル・OpenAI 等）は
 * 金額を出さず「単価不明」と出す（トークン数だけ）
 */
export const AI_MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5": { inputPerMillionUsd: 4, outputPerMillionUsd: 20 },
  "claude-sonnet-5-5": { inputPerMillionUsd: 2, outputPerMillionUsd: 10 },
  "claude-haiku-4-5": { inputPerMillionUsd: 1, outputPerMillionUsd: 5 },
}

/** バッチで送ったときの割引（単価に掛ける） */
export const BATCH_PRICE_RATIO = 0.5

/** 画像1枚のトークン数 ≈ 幅 × 高さ ÷ この値 */
const IMAGE_PIXELS_PER_TOKEN = 750

/** 文字1字あたりのトークン数（日本語は1字1トークン前後なので多めに見る） */
const TEXT_TOKENS_PER_CHARACTER = 1

/** アプリ共通の指示（出力の形・答案内の指示に従わない等）の字数の目安 */
const APP_INSTRUCTION_CHARACTER_COUNT = 1500

/** 答案1件あたりの出力（思考を含む）のトークン数の目安。effort で大きく変わる */
const OUTPUT_TOKENS_PER_ANSWER: Record<GradingEffort, number> = {
  low: 600,
  medium: 1500,
  high: 4000,
}

interface ImageSize {
  width: number
  height: number
}

export interface RunCostEstimateInput {
  model: string
  effort: GradingEffort
  mode: AiGradingRunMode
  /** 送る答案画像の大きさ（答案1件に1枚） */
  answerImages: readonly ImageSize[]
  /** 毎回いっしょに送る画像（問題用紙・模範解答の切り出し） */
  fixedImages: readonly ImageSize[]
  /** プロンプトの各欄（問題文・模範解答・採点基準）の字数の合計 */
  promptCharacterCount: number
}

export interface RunCostEstimate {
  requestCount: number
  inputTokens: number
  outputTokens: number
  /** 単価の分からないモデルでは null */
  costUsd: number | null
}

/** 画像1枚のトークン数の目安 */
export function estimateImageTokens(image: ImageSize): number {
  return Math.ceil((image.width * image.height) / IMAGE_PIXELS_PER_TOKEN)
}

/**
 * 実行1回の概算。答案1件ごとに「プロンプト＋固定の画像＋答案の画像」を1回送るとして数える
 * （キャッシュの割引は見込まない。見込まないぶん多めに出る）
 */
export function estimateRunCost(input: RunCostEstimateInput): RunCostEstimate {
  const requestCount = input.answerImages.length
  const fixedTokensPerRequest =
    Math.ceil(
      (input.promptCharacterCount + APP_INSTRUCTION_CHARACTER_COUNT) *
        TEXT_TOKENS_PER_CHARACTER
    ) +
    input.fixedImages.reduce(
      (acc, image) => acc + estimateImageTokens(image),
      0
    )
  const inputTokens =
    fixedTokensPerRequest * requestCount +
    input.answerImages.reduce(
      (acc, image) => acc + estimateImageTokens(image),
      0
    )
  const outputTokens = OUTPUT_TOKENS_PER_ANSWER[input.effort] * requestCount

  const price = AI_MODEL_PRICES[input.model]
  if (!price) {
    return { requestCount, inputTokens, outputTokens, costUsd: null }
  }
  const priceRatio = input.mode === "batch" ? BATCH_PRICE_RATIO : 1
  const costUsd =
    ((inputTokens * price.inputPerMillionUsd +
      outputTokens * price.outputPerMillionUsd) /
      1_000_000) *
    priceRatio
  return { requestCount, inputTokens, outputTokens, costUsd }
}
