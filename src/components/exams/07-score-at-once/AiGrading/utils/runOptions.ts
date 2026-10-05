/**
 * 実行のダイアログで使う表示の部品（事業者の表示名・金額）。
 * 手間・送り方・拡大率の選択肢は `components/common/AiRunOptionToggles.tsx` にある
 */

import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { AI_GRADING_PROVIDER_TERMS } from "@/lib/shared/aiGrading/consentText"

/** 事業者の表示名 */
export function providerDisplayName(provider: GradingProviderId): string {
  return AI_GRADING_PROVIDER_TERMS[provider].providerName
}

/** 米ドルの概算を見せる形にする */
export function formatUsd(costUsd: number): string {
  return costUsd < 0.01 ? "$0.01 未満" : `$${costUsd.toFixed(2)}`
}
