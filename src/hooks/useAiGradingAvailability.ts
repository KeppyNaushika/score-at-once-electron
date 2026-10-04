"use client"

import { useQuery } from "@tanstack/react-query"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { ProviderStatus } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import { AI_GRADING_CONSENT_VERSION } from "@/lib/shared/aiGrading/consentText"
import { aiProviderStatusesQuery } from "@/queries/aiProvider"

/**
 * その事業者への同意が「今の同意」か。
 *
 * 同意は「その端末で、その利用者が、その版の同意文に」行うもの（設計 §9-1）。
 * 版が今の同意文と違えば同意し直し、別の利用者の同意は今の利用者の同意にならない。
 */
export function isAiProviderConsentCurrent(
  status: ProviderStatus,
  currentUserId: string
): boolean {
  return (
    status.consent !== null &&
    status.consent.consentVersion === AI_GRADING_CONSENT_VERSION &&
    status.consent.userId === currentUserId
  )
}

/** その事業者で AI 採点を使えるか（今の同意があり、API キーが保存されている） */
export function isAiProviderUnlocked(
  status: ProviderStatus,
  currentUserId: string
): boolean {
  return status.hasApiKey && isAiProviderConsentCurrent(status, currentUserId)
}

/**
 * 事業者ごとに、この端末の今の利用者に AI 採点が解放されているか。
 *
 * 07 が「AI採点」モードを出すかどうかの判断に使う。取得前は全事業者を閉じたまま扱う
 * （解放されていないものを一瞬でも見せない）。
 */
export function useAiGradingAvailability(): {
  unlockedProviders: GradingProviderId[]
  isUnlocked: (provider: GradingProviderId) => boolean
} {
  const currentUser = useCurrentUser()
  const { data: providerStatuses } = useQuery(aiProviderStatusesQuery())
  const unlockedProviders = (providerStatuses ?? [])
    .filter((status) => isAiProviderUnlocked(status, currentUser.id))
    .map((status) => status.provider)
  return {
    unlockedProviders,
    isUnlocked: (provider) => unlockedProviders.includes(provider),
  }
}
