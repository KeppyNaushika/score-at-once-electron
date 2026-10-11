// @vitest-environment jsdom
/**
 * 採点モードの行の左端に出す、この試験の AI の費用の概算（AiExamCostBadge）のテスト。
 * - 事業者を使えて、この試験で AI に送った実行があれば、単価から求めた額を出す
 * - 単価の無いモデルの分があれば「+」を付ける
 * - AI 採点を使える事業者が無いとき・実行が無いときは何も出さない
 * window.electronAPI は偽物で、ネットワークにも実データにも触れない。
 */
import "../setup"

import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AiExamCostBadge } from "@/components/exams/07-score-at-once/AiGrading/AiExamCostBadge"
import type { AiGradingRunRow } from "@/components/exams/07-score-at-once/AiGrading/types"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { AiModelPrice } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { AI_GRADING_CONSENT_VERSION } from "@/lib/shared/aiGrading/consentText"
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

function renderBadge() {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <AiExamCostBadge examId="exam-1" />
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
    renderBadge()
    await waitFor(() =>
      expect(window.electronAPI.aiGrading.listRunsByExam).toHaveBeenCalled()
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
