/**
 * 見積もりで、固定部（キャッシュさせる前置き）を読み出し・書き込みの件数に分ける
 * （docs/vlm-grading-design.md §3-2）。
 *
 * - その場の送信は、最初の1件を先に送ってキャッシュを作ってから残りを並行させる
 *   （`electron-src/lib/aiGrading/gradingRunExecution.ts`）ので、1件目が書き込み・残りが読み出し
 * - バッチは並行に処理され、当たりは成り行き。同じモデルのバッチの実測の当たりの割合
 *   （無ければ事業者の示す下限）で分ける
 * - 固定部がモデルの最小の長さに届かなければキャッシュされない。Anthropic は固定部の最後に
 *   `cache_control` を置き（`providers/anthropicProvider.ts`）、OpenAI は自動で効く
 *   （`providers/openaiProvider.ts`。`prompt_cache_key` で振り分けをそろえる）
 *
 * 書き込みの単価（その場は5分・バッチは1時間）は `src/lib/aiUsageCost.ts` の
 * `computeUsageCost` が送り方で選ぶ。
 */

import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import type { AiGradingRunMode } from "@/types/aiGrading.types"

import { stripModelSnapshotDate } from "./imageTokens"
import { collectMeasuredAttempts, type MeasuredRun } from "./measuredUsage"

/**
 * バッチでキャッシュに当たる割合の目安（実測の無いとき）。
 * Anthropic はバッチのキャッシュを「成り行き」とし、当たりを 30〜98% とする。少なめの側を取る
 * （https://platform.claude.com/docs/en/build-with-claude/batch-processing ）
 */
const BATCH_CACHE_HIT_RATIO_GUIDELINE = 0.3

/**
 * キャッシュされる最小の長さ（トークン）。これより短い固定部は、印を付けてもキャッシュされない。
 * Anthropic: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
 * OpenAI: https://developers.openai.com/api/docs/guides/prompt-caching
 */
const ANTHROPIC_MINIMUM_CACHEABLE_TOKENS = new Map<string, number>([
  ["claude-fable-5-1", 512],
  ["claude-mythos-5-1", 512],
  ["claude-fable-5", 512],
  ["claude-mythos-5", 512],
  ["claude-opus-5-5", 512],
  ["claude-opus-5", 512],
  ["claude-sonnet-5-5", 512],
  ["claude-opus-4-8", 1024],
  ["claude-sonnet-5", 1024],
  ["claude-sonnet-4-6", 1024],
  ["claude-sonnet-4-5", 1024],
  ["claude-opus-4-1", 1024],
  ["claude-opus-4", 1024],
  ["claude-sonnet-4", 1024],
  ["claude-opus-4-7", 2048],
  ["claude-opus-4-6", 4096],
  ["claude-opus-4-5", 4096],
  ["claude-haiku-4-5", 4096],
])
/** 表に無い Anthropic のモデルは、キャッシュされにくい側（表の最大）とみなす */
const ANTHROPIC_UNKNOWN_MINIMUM_CACHEABLE_TOKENS = 4096
const OPENAI_MINIMUM_CACHEABLE_TOKENS = 1024

export function minimumCacheableTokens(
  provider: GradingProviderId,
  model: string
): number {
  switch (provider) {
    case "anthropic":
      return (
        ANTHROPIC_MINIMUM_CACHEABLE_TOKENS.get(stripModelSnapshotDate(model)) ??
        ANTHROPIC_UNKNOWN_MINIMUM_CACHEABLE_TOKENS
      )
    case "openai":
      return OPENAI_MINIMUM_CACHEABLE_TOKENS
  }
}

/** キャッシュの見込み方 */
export type CacheBasis =
  | { kind: "not_cached" }
  | { kind: "first_request_writes" }
  | {
      kind: "batch_hit_ratio"
      hitRatio: number
      /** 実測の試行の数。0 なら目安 */
      sampleCount: number
    }

/** キャッシュの見込みに要るもの */
interface PromptCacheTarget {
  provider: GradingProviderId
  model: string
  mode: AiGradingRunMode
  measuredRuns: readonly MeasuredRun[]
}

/** バッチでキャッシュに当たる割合（同じモデルのバッチの実測。無ければ目安） */
function estimateBatchHitRatio(
  input: PromptCacheTarget
): Extract<CacheBasis, { kind: "batch_hit_ratio" }> {
  const cachedSamples = collectMeasuredAttempts(input.measuredRuns, {
    provider: input.provider,
    model: input.model,
    mode: "batch",
  }).filter((sample) => sample.cacheReadTokens + sample.cacheWriteTokens > 0)
  if (cachedSamples.length === 0) {
    return {
      kind: "batch_hit_ratio",
      hitRatio: BATCH_CACHE_HIT_RATIO_GUIDELINE,
      sampleCount: 0,
    }
  }
  const hitCount = cachedSamples.filter(
    (sample) => sample.cacheReadTokens > 0
  ).length
  return {
    kind: "batch_hit_ratio",
    hitRatio: hitCount / cachedSamples.length,
    sampleCount: cachedSamples.length,
  }
}

/** 固定部を、読み出し・書き込みの件数に分ける（1件目は必ず書き込み） */
export function planPromptCache(
  input: PromptCacheTarget,
  requestCount: number,
  isCached: boolean
): { readCount: number; writeCount: number; basis: CacheBasis } {
  if (!isCached || requestCount === 0) {
    return { readCount: 0, writeCount: 0, basis: { kind: "not_cached" } }
  }
  if (input.mode === "realtime") {
    return {
      readCount: requestCount - 1,
      writeCount: 1,
      basis: { kind: "first_request_writes" },
    }
  }
  const basis = estimateBatchHitRatio(input)
  const readCount = Math.min(
    requestCount - 1,
    Math.round(requestCount * basis.hitRatio)
  )
  return { readCount, writeCount: requestCount - readCount, basis }
}
