import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/contexts/AuthContext"
import {
  DEFAULT_SCORING_STATUS_COLORS,
  type ScoringStatusColors,
  toScoringStatusColors,
} from "@/lib/scoringStatusColors"
import { userScoringStatusColorsQuery } from "@/queries/settings"

/**
 * 採点状態色。
 *
 * 設定画面と同じキャッシュを読むので、あちらで色を変えれば採点画面もその場で
 * 変わる（変更を伝える自作イベントは要らない）。
 */
export function useScoringStatusColors(): ScoringStatusColors {
  const { user } = useAuth()
  const { data: colors } = useQuery({
    ...userScoringStatusColorsQuery(user?.id),
    select: toScoringStatusColors,
  })

  return colors ?? DEFAULT_SCORING_STATUS_COLORS
}
