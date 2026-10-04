/**
 * 実行の設定（事業者・モデル・effort・送り方・拡大率）の選択肢（docs/vlm-grading-design.md §3-3）。
 *
 * renderer は main の値（`GRADING_EFFORTS` 等）を値として引けないので、同じ並びをここに置く
 * （設定画面の `AiGradingDefaultsSection` と同じ形）。
 */

import type {
  GradingEffort,
  GradingProviderId,
} from "@/electron-src/lib/aiGrading/providers/types"
import { AI_GRADING_PROVIDER_TERMS } from "@/lib/shared/aiGrading/consentText"
import type { AiGradingRunMode } from "@/types/aiGrading.types"

export const EFFORT_OPTIONS = [
  "low",
  "medium",
  "high",
] as const satisfies readonly GradingEffort[]

export const EFFORT_LABELS: Record<GradingEffort, string> = {
  low: "低（速い・安い）",
  medium: "中",
  high: "高（丁寧・高い）",
}

export const RUN_MODE_OPTIONS = [
  "realtime",
  "batch",
] as const satisfies readonly AiGradingRunMode[]

export const RUN_MODE_LABELS: Record<AiGradingRunMode, string> = {
  realtime: "すぐ（1件ずつ）",
  batch: "バッチ（安いが最大1日かかる）",
}

/** 送る画像の拡大率。1 = 原寸（推奨。拡大しても情報は増えず、画像のトークンが増えるだけ） */
export const IMAGE_SCALE_OPTIONS = [1, 1.5, 2] as const

/** 事業者の表示名 */
export function providerDisplayName(provider: GradingProviderId): string {
  return AI_GRADING_PROVIDER_TERMS[provider].providerName
}

/** 米ドルの概算を見せる形にする */
export function formatUsd(costUsd: number): string {
  return costUsd < 0.01 ? "$0.01 未満" : `$${costUsd.toFixed(2)}`
}
