"use client"

import { useQuery } from "@tanstack/react-query"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import {
  isAiProviderConsentCurrent,
  isAiProviderUnlocked,
} from "@/hooks/useAiGradingAvailability"
import {
  aiGradingSettingsQuery,
  aiModelCatalogsQuery,
  aiProviderStatusesQuery,
} from "@/queries/aiProvider"

/**
 * 「AI採点」の画面の読み取り（同意・キーの有無・既定値・モデルの一覧）。
 *
 * 書き込みは、書くコンポーネントがそれぞれ自分で `useMutation` を呼ぶ
 * （`mutate` を props で配ると、子から見て何を書くのかが分からなくなる）。
 */
export function useAiGradingSettings() {
  const currentUser = useCurrentUser()
  const { data: providerStatuses, isPending: statusesPending } = useQuery(
    aiProviderStatusesQuery()
  )
  const { data: settings, isPending: settingsPending } = useQuery(
    aiGradingSettingsQuery()
  )
  // 一覧はまだ取得していなくてよい（読めなければ未取得として扱う）ので、待たない
  const { data: modelCatalogs } = useQuery(aiModelCatalogsQuery())

  /** 事業者ごとの状態に、今の利用者の今の同意かどうかを添える（表示のための計算） */
  const providerStates = (providerStatuses ?? []).map((status) => ({
    status,
    isConsentCurrent: isAiProviderConsentCurrent(status, currentUser.id),
    /** 今の同意があり、キーも保存されている（送信先・一覧の取得に使える） */
    isUnlocked: isAiProviderUnlocked(status, currentUser.id),
    /** 取得しておいたモデルの一覧。まだ取得していなければ null */
    modelCatalog: modelCatalogs?.[status.provider] ?? null,
  }))

  return {
    providerStates,
    settings: settings ?? null,
    /** 1つでも今の同意がある事業者があるか（既定値の欄を出すかどうか） */
    hasAnyCurrentConsent: providerStates.some(
      (providerState) => providerState.isConsentCurrent
    ),
    isLoading: statusesPending || settingsPending,
  }
}
