import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import {
  type ScoringStatusColors,
  toScoringStatusColors,
} from "@/lib/scoringStatusColors"
import { parsePreference } from "@/lib/userPreferences"
import {
  userPreferenceQuery,
  userScoringStatusColorsQuery,
} from "@/queries/settings"

/**
 * 採点状態色。
 *
 * 土台にしているプリセット（`UserPreference`）に、個別に上書きした色（行）を重ねる。
 * 設定画面と同じキャッシュを読むので、あちらで色を変えれば採点画面もその場で
 * 変わる（変更を伝える自作イベントは要らない）。
 */
export function useScoringStatusColors(): ScoringStatusColors {
  const currentUser = useCurrentUser()
  const { data: overrides } = useQuery(
    userScoringStatusColorsQuery(currentUser.id)
  )
  const { data: storedPresetId } = useQuery(
    userPreferenceQuery(currentUser.id, "scoringColorPresetId")
  )

  return useMemo(
    () =>
      toScoringStatusColors(
        overrides ?? [],
        parsePreference("scoringColorPresetId", storedPresetId ?? null)
      ),
    [overrides, storedPresetId]
  )
}
