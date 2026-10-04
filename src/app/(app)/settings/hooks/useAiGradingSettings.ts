"use client"

import { useQuery } from "@tanstack/react-query"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { isAiProviderConsentCurrent } from "@/hooks/useAiGradingAvailability"
import {
  aiGradingSettingsQuery,
  aiProviderStatusesQuery,
} from "@/queries/aiProvider"

/**
 * 「実験的機能：AI採点」タブの読み取り。
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

  /** 事業者ごとの状態に、今の利用者の今の同意かどうかを添える（表示のための計算） */
  const providerStates = (providerStatuses ?? []).map((status) => ({
    status,
    isConsentCurrent: isAiProviderConsentCurrent(status, currentUser.id),
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
