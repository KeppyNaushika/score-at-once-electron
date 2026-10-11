// @vitest-environment jsdom
/**
 * 採点モードの行の左端に出す、この試験の AI の費用の概算（AiExamCostBadge）のテスト。
 * - 事業者を使えて、この試験で AI に送った実行があれば、単価から求めた額を出す
 * - 単価の無いモデルの分があれば「+」を付ける
 * - AI 採点を使える事業者が無いとき・実行が無いときは何も出さない
 * window.electronAPI は偽物で、ネットワークにも実データにも触れない。
 */
import "../setup"

import { useQuery } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AiExamCostBadge } from "@/components/exams/07-score-at-once/AiGrading/AiExamCostBadge"
import type { AiGradingRunRow } from "@/components/exams/07-score-at-once/AiGrading/types"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { AiModelPrice } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { AI_GRADING_CONSENT_VERSION } from "@/lib/shared/aiGrading/consentText"
import { aiGradingRunsOfExamQuery } from "@/queries/aiGrading"
import { aiPricingQuery, aiProviderStatusesQuery } from "@/queries/aiProvider"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CURRENT_USER_ID,
  makeRun,
} from "../aiGrading/helpers/aiGradingRowFixtures"

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const OPUS_PRICE: AiModelPrice = {
  provider: "anthropic",
  model: "claude-opus-5-5",
  inputPerMillionUsd: 10,
  outputPerMillionUsd: 50,
  cacheReadPerMillionUsd: 0,
  cacheWrite5mPerMillionUsd: 0,
  cacheWrite1hPerMillionUsd: 0,
}

function setupElectronApi(options: {
  runs: AiGradingRunRow[]
  modelPrices: AiModelPrice[]
  hasConsent: boolean
}) {
  Object.defineProperty(window, "electronAPI", {
    value: {
      aiGrading: { listRunsByExam: vi.fn(async () => options.runs) },
      aiProvider: {
        getStatuses: vi.fn(async () => [
          {
            provider: "anthropic",
            hasApiKey: options.hasConsent,
            isEncryptionAvailable: true,
            consent: options.hasConsent
              ? {
                  userId: CURRENT_USER_ID,
                  consentVersion: AI_GRADING_CONSENT_VERSION,
                  consentedAt: "2026-10-05T00:00:00.000Z",
                }
              : null,
          },
        ]),
        getPricing: vi.fn(async () => ({
          modelPrices: options.modelPrices,
          batchPricePercents: { anthropic: null, openai: null },
        })),
      },
    },
    writable: true,
    configurable: true,
  })
}

/**
 * 事業者の状態・実行・単価が届いたかの印。バッジが無いのは届く前の姿と同じなので、
 * 「出さない」を見るときは届いたことを待つ（同じキャッシュを読むので取得は増えない）
 */
function RunsAndPricingLoadedProbe() {
  const { isSuccess: isStatusesLoaded } = useQuery(aiProviderStatusesQuery())
  const { isSuccess: isRunsLoaded } = useQuery(
    aiGradingRunsOfExamQuery("exam-1")
  )
  const { isSuccess: isPricingLoaded } = useQuery(aiPricingQuery())
  return (
    <output data-testid="runs-and-pricing-loaded">
      {String(isStatusesLoaded && isRunsLoaded && isPricingLoaded)}
    </output>
  )
}

function renderBadge(options: { withLoadProbe?: boolean } = {}) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <AiExamCostBadge examId="exam-1" />
        {options.withLoadProbe && <RunsAndPricingLoadedProbe />}
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

describe("AiExamCostBadge", () => {
  it("この試験で AI に送った分の費用の概算を出す", async () => {
    setupElectronApi({
      runs: [makeRun({ inputTokens: 100_000, outputTokens: 10_000 })],
      modelPrices: [OPUS_PRICE],
      hasConsent: true,
    })
    renderBadge()
    // 入力 0.1M × $10 + 出力 0.01M × $50 = $1.50
    expect(await screen.findByTestId("ai-exam-cost-badge")).toHaveTextContent(
      "AI $1.50"
    )
  })

  it("単価の無いモデルの分があれば「+」を付ける", async () => {
    setupElectronApi({
      runs: [makeRun({ inputTokens: 100_000, outputTokens: 10_000 })],
      modelPrices: [],
      hasConsent: true,
    })
    renderBadge()
    expect(await screen.findByTestId("ai-exam-cost-badge")).toHaveTextContent(
      "AI $0.00+"
    )
  })

  it("実行が無ければ何も出さない", async () => {
    setupElectronApi({ runs: [], modelPrices: [OPUS_PRICE], hasConsent: true })
    renderBadge({ withLoadProbe: true })
    await waitFor(() =>
      expect(screen.getByTestId("runs-and-pricing-loaded")).toHaveTextContent(
        "true"
      )
    )
    expect(screen.queryByTestId("ai-exam-cost-badge")).toBeNull()
  })

  it("AI 採点を使える事業者が無ければ、実行を読みにも行かない", async () => {
    setupElectronApi({
      runs: [makeRun({ inputTokens: 100_000 })],
      modelPrices: [OPUS_PRICE],
      hasConsent: false,
    })
    renderBadge()
    await waitFor(() =>
      expect(window.electronAPI.aiProvider.getStatuses).toHaveBeenCalled()
    )
    expect(window.electronAPI.aiGrading.listRunsByExam).not.toHaveBeenCalled()
    expect(screen.queryByTestId("ai-exam-cost-badge")).toBeNull()
  })
})
