// @vitest-environment jsdom
/**
 * 07 の「AI採点」モード（docs/vlm-grading-design.md §9-1・§10）。
 *
 * ここで固定すること:
 * - 同意して API キーを保存した事業者が無ければ「AI採点」は採点モードの選択肢に出ない
 * - 実行ダイアログは選び方ごとの件数を出し、白紙の答案は数えない（送らない）
 * - 「採用」は表示中の試行を、求めた注釈の置き場所つきで採用の書き込みへ渡す
 *
 * window.electronAPI は偽物で、ネットワークにも実際のキーにも実データにも触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiAnswerDetailPanel } from "@/components/exams/07-score-at-once/AiGrading/AiAnswerDetailPanel"
import { AiGradingRunDialog } from "@/components/exams/07-score-at-once/AiGrading/AiGradingRunDialog"
import type { AiGradingAnswer } from "@/components/exams/07-score-at-once/AiGrading/types"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import GradingModeToggle from "@/components/exams/07-score-at-once/ScoringMain/GradingModeToggle"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { AI_GRADING_CONSENT_VERSION } from "@/lib/shared/aiGrading/consentText"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makeAttemptWithRun,
  makeInk,
  makePrompt,
  makeQuestionScore,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const SETTINGS: AiGradingSettings = {
  defaultProvider: "anthropic",
  defaultModels: { anthropic: "claude-opus-5-5", openai: "gpt-5.5" },
  defaultEffort: "medium",
  concurrency: 4,
  budgetWarningUsd: null,
  openaiCompatibleBaseUrl: null,
}

const cropRegion: QuestionAnswerRegionRow = {
  id: CROP_REGION_ID,
  examPageId: EXAM_PAGE_ID,
  label: "1-(1)",
  type: "QUESTION_ANSWER",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.2,
  points: 4,
  orderIndex: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  examPage: {
    id: EXAM_PAGE_ID,
    examId: "exam-1",
    pageNumber: 1,
    imagePath: "master/page1.png",
    pageSize: "A4",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  cropSubtotals: [],
}

/** main の代わり。書き込みは呼ばれたことだけを覚える */
function installFakeElectronApi(options: { isUnlocked: boolean }) {
  const aiGrading = {
    estimateRun: vi.fn(async (input: { examStudentIds: string[] }) => ({
      answerImages: input.examStudentIds.map((examStudentId) => ({
        examStudentId,
        width: 750,
        height: 1000,
      })),
      questionImage: null,
      modelAnswerImage: null,
    })),
    startRun: vi.fn(async () => ({ id: "run-new" })),
    adoptAttempts: vi.fn(
      async (input: { adoptions: { attemptId: string }[] }) =>
        input.adoptions.map((adoption) => ({
          targetId: adoption.attemptId,
          outcome: "adopted",
        }))
    ),
    listRuns: vi.fn(async () => []),
  }
  const aiProvider = {
    getStatuses: vi.fn(async () => [
      {
        provider: "anthropic",
        hasApiKey: options.isUnlocked,
        isEncryptionAvailable: true,
        consent: options.isUnlocked
          ? {
              userId: CURRENT_USER_ID,
              consentVersion: AI_GRADING_CONSENT_VERSION,
              consentedAt: "2026-10-05T00:00:00.000Z",
            }
          : null,
      },
      {
        provider: "openai",
        hasApiKey: false,
        isEncryptionAvailable: true,
        consent: null,
      },
    ]),
  }
  const settings = { getUserKeyboardShortcuts: vi.fn(async () => ({})) }
  Object.defineProperty(window, "electronAPI", {
    value: { aiGrading, aiProvider, settings },
    writable: true,
    configurable: true,
  })
  return aiGrading
}

function renderWithProviders(children: ReactNode) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>{children}</ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

function reviewed(answer: AiGradingAnswer) {
  return {
    answer,
    review: reviewAnswer(answer, {
      chosenAttemptIdByExamStudentId: new Map(),
      selectedPromptId: "prompt-1",
      points: 4,
    }),
  }
}

describe("採点モードの選択肢", () => {
  beforeEach(() => vi.clearAllMocks())

  it("解放されていなければ「AI採点」を出さない", async () => {
    installFakeElectronApi({ isUnlocked: false })
    renderWithProviders(
      <GradingModeToggle mode="grid" onModeChange={vi.fn()} />
    )
    await waitFor(() =>
      expect(window.electronAPI.aiProvider.getStatuses).toHaveBeenCalled()
    )
    expect(screen.getByRole("radio", { name: /一覧表示/ })).toBeTruthy()
    expect(screen.queryByRole("radio", { name: /AI採点/ })).toBeNull()
  })

  it("同意してキーを保存した事業者があれば「AI採点」を出す", async () => {
    installFakeElectronApi({ isUnlocked: true })
    renderWithProviders(
      <GradingModeToggle mode="grid" onModeChange={vi.fn()} />
    )
    expect(await screen.findByRole("radio", { name: /AI採点/ })).toBeTruthy()
  })
})

describe("実行ダイアログ", () => {
  beforeEach(() => vi.clearAllMocks())

  it("選び方ごとの件数を出し、白紙は数えず、確認に件数と送信先を出す", async () => {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    const reviewedAnswers = [
      reviewed(makeAnswer("s1")),
      reviewed(makeAnswer("s2")),
      reviewed(
        makeAnswer("s-blank", {
          inkMeasurement: makeInk({ blankness: "blank" }),
        })
      ),
      reviewed(makeAnswer("s-scored")),
    ]
    renderWithProviders(
      <AiGradingRunDialog
        open
        onOpenChange={vi.fn()}
        examId="exam-1"
        cropRegion={cropRegion}
        settings={SETTINGS}
        initialProvider="anthropic"
        unlockedProviders={["anthropic"]}
        prompt={makePrompt()}
        reviewedAnswers={reviewedAnswers}
        questionScores={[makeQuestionScore({ examStudentId: "s-scored" })]}
        currentUserId={CURRENT_USER_ID}
        selectedExamStudentIds={new Set()}
      />
    )

    expect(
      screen.getByTestId("ai-grading-target-count-unscored").textContent
    ).toBe("2件")
    expect(screen.getByTestId("ai-grading-target-count-all").textContent).toBe(
      "3件"
    )
    expect(
      screen.getByTestId("ai-grading-target-count-scoredCheck").textContent
    ).toBe("1件")
    expect(screen.getByText(/1\s*件を除きました/)).toBeTruthy()
    expect(await screen.findByTestId("ai-run-request-count")).toHaveTextContent(
      "2件"
    )

    await userEvent.click(screen.getByRole("button", { name: "送信の確認へ" }))
    const confirmation = screen.getByTestId("ai-run-confirmation")
    expect(confirmation).toHaveTextContent("2件の答案を Anthropic")
    expect(
      within(screen.getByRole("alert")).getByText("実験的機能")
    ).toBeTruthy()

    await userEvent.click(
      screen.getByRole("button", { name: "Anthropic へ送信する" })
    )
    await waitFor(() => expect(aiGrading.startRun).toHaveBeenCalledTimes(1))
    expect(aiGrading.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        promptId: "prompt-1",
        examStudentIds: ["s1", "s2"],
        provider: "anthropic",
        model: "claude-opus-5-5",
        mode: "realtime",
        imageScale: 1,
      })
    )
  })
})

describe("採用", () => {
  beforeEach(() => vi.clearAllMocks())

  it("表示中の試行を、注釈の置き場所つきで採用へ渡す（未採点なら確認なし）", async () => {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    const answer = makeAnswer("s1", {
      attempts: [
        makeAttemptWithRun({
          examStudentId: "s1",
          id: "attempt-s1",
          status: "partial",
          partialScore: 2,
          annotationText: "途中式が足りない",
        }),
      ],
    })
    renderWithProviders(
      <AiAnswerDetailPanel
        examId="exam-1"
        cropRegion={cropRegion}
        pageSize="A4"
        reviewedAnswer={reviewed(answer)}
        promptNumberById={new Map([["prompt-1", 1]])}
        onChooseAttempt={vi.fn()}
      />
    )
    expect(screen.getByTestId("ai-annotation-preview")).toHaveTextContent(
      "途中式が足りない"
    )

    await userEvent.click(
      screen.getByRole("button", { name: /自分の採点として採用/ })
    )
    await waitFor(() =>
      expect(aiGrading.adoptAttempts).toHaveBeenCalledTimes(1)
    )
    expect(aiGrading.adoptAttempts).toHaveBeenCalledWith({
      adoptions: [
        {
          attemptId: "attempt-s1",
          annotation: {
            x: expect.any(Number),
            y: expect.any(Number),
            text: expect.stringContaining("途中式"),
            fontSize: 5,
          },
        },
      ],
      overwrite: false,
    })
  })

  it("注釈文が空なら注釈は null、採点済みなら上書きを確かめてから渡す", async () => {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    const answer = makeAnswer("s1", {
      questionScore: makeQuestionScore({
        examStudentId: "s1",
        status: "incorrect",
      }),
      attempts: [makeAttemptWithRun({ examStudentId: "s1", id: "attempt-s1" })],
    })
    renderWithProviders(
      <AiAnswerDetailPanel
        examId="exam-1"
        cropRegion={cropRegion}
        pageSize="A4"
        reviewedAnswer={reviewed(answer)}
        promptNumberById={new Map([["prompt-1", 1]])}
        onChooseAttempt={vi.fn()}
      />
    )
    await userEvent.click(
      screen.getByRole("button", { name: /自分の採点として採用/ })
    )
    expect(aiGrading.adoptAttempts).not.toHaveBeenCalled()
    await userEvent.click(
      await screen.findByRole("button", { name: "上書きして採用" })
    )
    await waitFor(() =>
      expect(aiGrading.adoptAttempts).toHaveBeenCalledWith({
        adoptions: [{ attemptId: "attempt-s1", annotation: null }],
        overwrite: true,
      })
    )
  })
})
