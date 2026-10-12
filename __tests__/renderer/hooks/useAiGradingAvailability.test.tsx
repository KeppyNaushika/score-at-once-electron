// @vitest-environment jsdom
/**
 * AI 採点が解放されているか（07 が「AI採点」モードを出すかの判断）。
 *
 * 解放 = 今の利用者が今の版の同意文に同意していて、かつ API キーが保存されている。
 * どれか1つでも欠ければ閉じたまま。取得前も閉じたまま扱う。
 */

import "../setup"

import { useQuery } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ProviderStatus } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { useAiGradingAvailability } from "@/hooks/useAiGradingAvailability"
import { AI_GRADING_CONSENT_VERSION } from "@/lib/shared/aiGrading/consentText"
import { aiProviderStatusesQuery } from "@/queries/aiProvider"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const CURRENT_USER_ID = "user-1"

vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: () => ({ id: CURRENT_USER_ID, name: "田中先生" }),
}))

const CURRENT_CONSENT = {
  userId: CURRENT_USER_ID,
  consentVersion: AI_GRADING_CONSENT_VERSION,
  consentedAt: "2026-10-05T00:00:00.000Z",
}

function installStatuses(statuses: ProviderStatus[]) {
  const getStatuses = vi.fn(async () => statuses)
  Object.defineProperty(window, "electronAPI", {
    value: { aiProvider: { getStatuses } },
    writable: true,
    configurable: true,
  })
  return getStatuses
}

describe("useAiGradingAvailability", () => {
  it("今の同意とキーがそろった事業者だけを解放する", async () => {
    const getStatuses = installStatuses([
      {
        provider: "anthropic",
        hasApiKey: true,
        isEncryptionAvailable: true,
        consent: CURRENT_CONSENT,
      },
      // 同意はあるがキーが無い
      {
        provider: "openai",
        hasApiKey: false,
        isEncryptionAvailable: true,
        consent: CURRENT_CONSENT,
      },
    ])
    const { result } = renderHook(() => useAiGradingAvailability(), {
      wrapper: createQueryWrapper(),
    })

    // 取得前は閉じている
    expect(result.current.unlockedProviders).toEqual([])
    await waitFor(() => expect(getStatuses).toHaveBeenCalled())
    await waitFor(() =>
      expect(result.current.unlockedProviders).toEqual(["anthropic"])
    )
  })

  it("版の古い同意・別の利用者の同意では、キーがあっても解放しない", async () => {
    installStatuses([
      {
        provider: "anthropic",
        hasApiKey: true,
        isEncryptionAvailable: true,
        consent: { ...CURRENT_CONSENT, consentVersion: "2000-01-01-old" },
      },
      {
        provider: "openai",
        hasApiKey: true,
        isEncryptionAvailable: true,
        consent: { ...CURRENT_CONSENT, userId: "someone-else" },
      },
    ])
    // 既定値（[]）と期待値が同じなので、状態が届いたことを同じキャッシュの見張りで待つ。
    // 見張りは自分では取りに行かない（取得はフックだけが行う）
    const { result } = renderHook(
      () => ({
        availability: useAiGradingAvailability(),
        statusesProbe: useQuery({ ...aiProviderStatusesQuery(), enabled: false }),
      }),
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() =>
      expect(result.current.statusesProbe.data).toHaveLength(2)
    )
    expect(result.current.availability.unlockedProviders).toEqual([])
  })
})
