import { useMutation, useQueries, useQuery } from "@tanstack/react-query"

import {
  buildScoringSettings,
  SCORING_PREFERENCE_KEYS,
} from "@/components/exams/07-score-at-once/ScoringMain/scoringPreferences"
import {
  setUserClickScoringActionMutation,
  setUserPreferenceMutation,
  userClickScoringActionsQuery,
  userPreferenceQuery,
} from "@/queries/settings"
import {
  DEFAULT_CLICK_SCORING_CONFIG,
  toClickScoringConfig,
} from "@/types/clickScoring.types"

/** 採点画面の利用者ごとの設定（表示・操作・クリック採点の割り当て） */
export function useScoringPreferences(userId: string) {
  // 採点画面の設定。保存文字列を並べて取り、値の組み立ては純粋関数が行う
  const preferenceQueries = useQueries({
    queries: SCORING_PREFERENCE_KEYS.map((key) =>
      userPreferenceQuery(userId, key)
    ),
  })
  const setPreference = useMutation(setUserPreferenceMutation(userId))
  // クリック回数ごとの動作は回数ごとに1行。**塊で書かない**（続けて2つ変えると
  // 先の1つが消える）
  const { data: clickScoringConfig = DEFAULT_CLICK_SCORING_CONFIG } = useQuery({
    ...userClickScoringActionsQuery(userId),
    select: toClickScoringConfig,
  })
  const { mutate: setClickAction } = useMutation(
    setUserClickScoringActionMutation(userId)
  )
  const scoringSettings = buildScoringSettings(
    preferenceQueries.map((preferenceQuery) => preferenceQuery.data ?? null),
    setPreference.mutate
  )
  return { scoringSettings, clickScoringConfig, setClickAction }
}
