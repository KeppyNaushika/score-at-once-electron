/**
 * 実行のダイアログで使う表示の部品（事業者の表示名）。金額の見せ方は `src/lib/aiUsageCost.ts`。
 * 手間・送り方・拡大率の選択肢は `components/common/AiRunOptionToggles.tsx` にある
 */

import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { AI_GRADING_PROVIDER_TERMS } from "@/lib/shared/aiGrading/consentText"

/** 事業者の表示名 */
export function providerDisplayName(provider: GradingProviderId): string {
  return AI_GRADING_PROVIDER_TERMS[provider].providerName
}
