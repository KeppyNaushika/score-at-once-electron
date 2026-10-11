/**
 * 自分が過去に送った採点の実測（試行ごとのトークン数）を、見積もりの根拠として引く
 * （docs/vlm-grading-design.md §3-2）。
 *
 * 実行の行は main が返したまま（`myAiGradingRunsQuery`）を受け取り、絞り込みと集計はここで行う。
 * 採点（grade）の使用量は試行の列にある（`src/lib/aiUsageCost.ts` の `sumRunTokenUsage`）。
 */

import { type RecordedTokenUsage, totalTokenCount } from "@/lib/aiUsageCost"
import { isStage1RunPurpose } from "@/types/aiGrading.types"

import { stripModelSnapshotDate } from "./imageTokens"

/** 実行の行のうち、実測を引くのに要るもの */
export interface MeasuredRun {
  purpose: string
  promptId: string
  provider: string
  model: string
  effort: string
  mode: string
  prompt: { cropRegionId: string }
  attempts: readonly RecordedTokenUsage[]
}

/** 実測を絞る条件。省いた項目では絞らない */
export interface MeasuredRunCondition {
  provider: string
  model: string
  promptId?: string
  cropRegionId?: string
  effort?: string
  mode?: string
}

/**
 * 条件に合う実行の試行のうち、使用量の記録があるもの（答案1件ぶんの実測）。
 * 送る前・中止で使用量の無い試行は数えない。失敗した試行も、使ったトークンは実際に
 * 払っているので数える。モデルは日付の付いたスナップショットも同じモデルとみなす
 */
export function collectMeasuredAttempts(
  runs: readonly MeasuredRun[],
  condition: MeasuredRunCondition
): RecordedTokenUsage[] {
  const model = stripModelSnapshotDate(condition.model)
  return runs
    .filter(
      (run) =>
        isStage1RunPurpose(run.purpose) &&
        run.provider === condition.provider &&
        stripModelSnapshotDate(run.model) === model &&
        (condition.promptId === undefined ||
          run.promptId === condition.promptId) &&
        (condition.cropRegionId === undefined ||
          run.prompt.cropRegionId === condition.cropRegionId) &&
        (condition.effort === undefined || run.effort === condition.effort) &&
        (condition.mode === undefined || run.mode === condition.mode)
    )
    .flatMap((run) =>
      run.attempts.filter((attempt) => totalTokenCount(attempt) > 0)
    )
}

/** 両端から除く割合 */
const TRIM_RATIO = 0.1

/**
 * 両端の 10% ずつを除いた平均。空なら null。
 *
 * 見積もるのは合計（件数 × 1件あたり）なので、中央値ではなく平均の側に寄せる
 * （出力は右に裾が長く、中央値では合計を少なく見積もる）。ただし出力の上限で
 * 打ち切られた試行のような外れ値に引っ張られないよう、両端を除く
 */
export function trimmedMean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const trimCount = Math.floor(sorted.length * TRIM_RATIO)
  const kept = sorted.slice(trimCount, sorted.length - trimCount)
  return kept.reduce((acc, count) => acc + count, 0) / kept.length
}

/** 入力の欄の合計（キャッシュの読み書きを含む。3つは重ならない） */
export function totalInputTokens(usage: RecordedTokenUsage): number {
  return usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}
