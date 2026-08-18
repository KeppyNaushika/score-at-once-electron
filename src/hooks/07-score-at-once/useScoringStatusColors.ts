import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/contexts/AuthContext"
import {
  DEFAULT_SCORING_STATUS_COLORS,
  parseScoringStatusColors,
  type ScoringStatusColors,
} from "@/lib/scoringStatusColors"
import { userPreferenceQuery } from "@/queries/settings"

/**
 * 採点状態色。
 *
 * 設定画面と同じキャッシュを読むので、あちらで色を変えれば採点画面もその場で
 * 変わる（変更を伝える自作イベントは要らない）。
 */
export function useScoringStatusColors(): ScoringStatusColors {
  const { user } = useAuth()
  const { data: stored } = useQuery({
    ...userPreferenceQuery(user?.id, "scoringStatusColors"),
    select: parseScoringStatusColors,
  })

  return stored ?? DEFAULT_SCORING_STATUS_COLORS
}
