/**
 * 採点の実行の費用の**概算**（docs/vlm-grading-design.md §3-2・§10）。
 *
 * main は送る画像の大きさ（画素）だけを返し、トークン数と金額はここで求める。
 * 実際の請求は事業者の計算（思考のトークン・キャッシュの効き）で決まるので、
 * 画面には必ず「概算」と添える。単価はアプリが持たず、利用者が入れた単価
 * （`AiPricing`）で `src/lib/aiUsageCost.ts` が金額にする。
 */

import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type {
  GradingEffort,
  GradingProviderId,
} from "@/electron-src/lib/aiGrading/providers/types"
import { computeUsageCost, type UsageCost } from "@/lib/aiUsageCost"
import type { AiGradingRunMode } from "@/types/aiGrading.types"

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
  provider: GradingProviderId
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
  /** 利用者が入れた単価での金額。単価が無ければ金額を出さない */
  cost: UsageCost
}

/** 画像1枚のトークン数の目安 */
export function estimateImageTokens(image: ImageSize): number {
  return Math.ceil((image.width * image.height) / IMAGE_PIXELS_PER_TOKEN)
}

/**
 * 実行1回の概算。答案1件ごとに「プロンプト＋固定の画像＋答案の画像」を1回送るとして数える
 * （キャッシュの割引は見込まない。見込まないぶん多めに出る）
 */
export function estimateRunCost(
  input: RunCostEstimateInput,
  pricing: AiPricing
): RunCostEstimate {
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
  const cost = computeUsageCost(
    pricing,
    { provider: input.provider, model: input.model, mode: input.mode },
    { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 }
  )
  return { requestCount, inputTokens, outputTokens, cost }
}
