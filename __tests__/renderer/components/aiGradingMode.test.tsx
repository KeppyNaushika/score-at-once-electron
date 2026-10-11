// @vitest-environment jsdom
/**
 * 07 の「AI採点」モード（docs/vlm-grading-design.md §9-1・§10）。
 *
 * ここで固定すること:
 * - 同意して API キーを保存した事業者が無ければ「AI採点」は採点モードの選択肢に出ない
 * - 実行ダイアログは送る答案の4つの選び方（未採点・無答以外・全て・選択）ごとに件数を出し、
 *   既定は未採点。切り替えると件数と送る答案が変わる。選んでいなければ「選択」は選べない
 * - 採点の履歴は目的ごとに古い順の番号（採点 1・チェック 1）と採点指示の番号で呼ぶ
 *
 * window.electronAPI は偽物で、ネットワークにも実際のキーにも実データにも触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingRunDialog } from "@/components/exams/07-score-at-once/AiGrading/AiGradingRunDialog"
import { AiRunHistorySection } from "@/components/exams/07-score-at-once/AiGrading/AiRunHistorySection"
import type {
  AiGradingAnswer,
  AiGradingRunRow,
} from "@/components/exams/07-score-at-once/AiGrading/types"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import GradingModeToggle from "@/components/exams/07-score-at-once/ScoringMain/GradingModeToggle"
import { ScoringStatusFilterButtons } from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringStatusFilterButtons"
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
  makePrompt,
  makeQuestionScore,
  makeRun,
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
  defaultMode: "realtime",
  concurrency: 4,
  budgetWarningUsd: null,
  openaiCompatibleBaseUrl: null,
  anthropicPricingSourceUrl: "https://example.test/pricing",
  openaiPricingSourceUrl: "https://example.test/openai-pricing",
  defaultAnnotationInstruction: "",
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
  scoringMethod: "points",
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

/** 採点行の書き込みの代わり（呼ばれたことだけを覚える） */
const fakeScoringApi = {
  setQuestionScore: vi.fn(async () => ({})),
  updateQuestionScore: vi.fn(async () => ({ status: "updated" })),
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
      questionImages: [],
      modelAnswerImage: null,
    })),
    startRun: vi.fn(async () => ({ id: "run-new" })),
    listRuns: vi.fn(async () => []),
    listRunsByExam: vi.fn(async () => []),
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
    getModelCatalogs: vi.fn(async () => ({ anthropic: null, openai: null })),
    // 単価は入れていない（アプリは単価を持たない）
    getPricing: vi.fn(async () => ({
      modelPrices: [],
      batchPricePercents: { anthropic: null, openai: null },
    })),
  }
  const settings = { getUserKeyboardShortcuts: vi.fn(async () => ({})) }
  Object.defineProperty(window, "electronAPI", {
    value: {
      aiGrading,
      aiProvider,
      settings,
      setQuestionScore: fakeScoringApi.setQuestionScore,
      updateQuestionScore: fakeScoringApi.updateQuestionScore,
    },
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

  it("既定は未採点の答案。件数を出し、確認に件数と送信先を出す（採点済み・無答の答案は送らない）", async () => {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    const reviewedAnswers = [
      reviewed(makeAnswer("s1")),
      reviewed(makeAnswer("s2")),
      reviewed(makeAnswer("s-no-answer")),
      reviewed(makeAnswer("s-scored")),
    ]
    renderWithProviders(
      <AiGradingRunDialog
        purpose="grade"
        open
        onOpenChange={vi.fn()}
        examId="exam-1"
        cropRegion={cropRegion}
        settings={SETTINGS}
        initialProvider="anthropic"
        unlockedProviders={["anthropic"]}
        prompt={makePrompt()}
        promptNumber={1}
        reviewedAnswers={reviewedAnswers}
        questionScores={[
          makeQuestionScore({ examStudentId: "s-scored" }),
          makeQuestionScore({
            examStudentId: "s-no-answer",
            status: "no_answer",
          }),
        ]}
        currentUserId={CURRENT_USER_ID}
        selectedExamStudentIds={new Set()}
      />
    )

    expect(
      screen.getByRole("radio", { name: /未採点の答案（2 件）/ })
    ).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("button", { name: "送信の確認へ" })).toBeEnabled()
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

  function renderScopeDialog(selectedExamStudentIds: ReadonlySet<string>) {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    renderWithProviders(
      <AiGradingRunDialog
        purpose="grade"
        open
        onOpenChange={vi.fn()}
        examId="exam-1"
        cropRegion={cropRegion}
        settings={SETTINGS}
        initialProvider="anthropic"
        unlockedProviders={["anthropic"]}
        prompt={makePrompt()}
        promptNumber={1}
        reviewedAnswers={[
          reviewed(makeAnswer("s1")),
          reviewed(makeAnswer("s-no-answer")),
          reviewed(makeAnswer("s-scored")),
          reviewed(makeAnswer("s4")),
        ]}
        questionScores={[
          makeQuestionScore({ examStudentId: "s-scored" }),
          makeQuestionScore({
            examStudentId: "s-no-answer",
            status: "no_answer",
          }),
        ]}
        currentUserId={CURRENT_USER_ID}
        selectedExamStudentIds={selectedExamStudentIds}
      />
    )
    return aiGrading
  }

  it("選び方ごとに件数を出し、切り替えると件数と送る答案が変わる", async () => {
    const aiGrading = renderScopeDialog(new Set(["s-scored"]))
    expect(
      screen.getByRole("radio", { name: /未採点の答案（2 件）/ })
    ).toBeTruthy()
    expect(
      screen.getByRole("radio", { name: /無答以外の全ての答案（3 件）/ })
    ).toBeTruthy()
    expect(
      screen.getByRole("radio", { name: /^全ての答案（4 件）/ })
    ).toBeTruthy()
    const selectedChoice = screen.getByRole("radio", {
      name: /選択した答案（1 件）/,
    })
    expect(selectedChoice).toBeEnabled()

    await userEvent.click(
      screen.getByRole("radio", { name: /無答以外の全ての答案/ })
    )
    await waitFor(() =>
      expect(screen.getByTestId("ai-run-request-count")).toHaveTextContent(
        "3件"
      )
    )

    await userEvent.click(selectedChoice)
    await waitFor(() =>
      expect(screen.getByTestId("ai-run-request-count")).toHaveTextContent(
        "1件"
      )
    )
    await userEvent.click(screen.getByRole("button", { name: "送信の確認へ" }))
    expect(screen.getByTestId("ai-run-confirmation")).toHaveTextContent(
      "1件の答案を Anthropic"
    )
    await userEvent.click(
      screen.getByRole("button", { name: "Anthropic へ送信する" })
    )
    await waitFor(() => expect(aiGrading.startRun).toHaveBeenCalledTimes(1))
    expect(aiGrading.startRun).toHaveBeenCalledWith(
      expect.objectContaining({ examStudentIds: ["s-scored"] })
    )
  })

  it("無答以外: 自分が無答を付けた答案だけを外して送る", async () => {
    const aiGrading = renderScopeDialog(new Set())
    await userEvent.click(
      screen.getByRole("radio", { name: /無答以外の全ての答案/ })
    )
    await userEvent.click(screen.getByRole("button", { name: "送信の確認へ" }))
    await userEvent.click(
      screen.getByRole("button", { name: "Anthropic へ送信する" })
    )
    await waitFor(() => expect(aiGrading.startRun).toHaveBeenCalledTimes(1))
    expect(aiGrading.startRun).toHaveBeenCalledWith(
      expect.objectContaining({ examStudentIds: ["s1", "s-scored", "s4"] })
    )
  })

  it("答案を選んでいなければ「選択した答案」は選べない", () => {
    renderScopeDialog(new Set())
    expect(
      screen.getByRole("radio", { name: /選択した答案（0 件）/ })
    ).toBeDisabled()
  })

  it("選んだ選び方の件数が 0 件なら送信の確認へ進めない", async () => {
    installFakeElectronApi({ isUnlocked: true })
    renderWithProviders(
      <AiGradingRunDialog
        purpose="grade"
        open
        onOpenChange={vi.fn()}
        examId="exam-1"
        cropRegion={cropRegion}
        settings={SETTINGS}
        initialProvider="anthropic"
        unlockedProviders={["anthropic"]}
        prompt={makePrompt()}
        promptNumber={1}
        reviewedAnswers={[reviewed(makeAnswer("s-scored"))]}
        questionScores={[makeQuestionScore({ examStudentId: "s-scored" })]}
        currentUserId={CURRENT_USER_ID}
        selectedExamStudentIds={new Set()}
      />
    )
    expect(
      screen.getByRole("radio", { name: /未採点の答案（0 件）/ })
    ).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("button", { name: "送信の確認へ" })).toBeDisabled()
    await userEvent.click(
      screen.getByRole("radio", { name: /^全ての答案（1 件）/ })
    )
    expect(screen.getByRole("button", { name: "送信の確認へ" })).toBeEnabled()
  })
})

describe("実行ダイアログの既定値", () => {
  beforeEach(() => vi.clearAllMocks())

  function renderRunDialog(settings: AiGradingSettings) {
    installFakeElectronApi({ isUnlocked: true })
    renderWithProviders(
      <AiGradingRunDialog
        purpose="grade"
        open
        onOpenChange={vi.fn()}
        examId="exam-1"
        cropRegion={cropRegion}
        settings={settings}
        initialProvider="anthropic"
        unlockedProviders={["anthropic"]}
        prompt={makePrompt()}
        promptNumber={1}
        reviewedAnswers={[reviewed(makeAnswer("s1"))]}
        questionScores={[]}
        currentUserId={CURRENT_USER_ID}
        selectedExamStudentIds={new Set()}
      />
    )
  }

  it("Effort・処理は設定画面の既定値を選んだ状態で開き、切り替えボタンで変えられる（拡大率は選ばせない）", async () => {
    renderRunDialog({
      ...SETTINGS,
      defaultEffort: "high",
      defaultMode: "batch",
    })
    const effortGroup = screen.getByRole("radiogroup", { name: "Effort" })
    const modeGroup = screen.getByRole("radiogroup", { name: "処理" })
    expect(
      screen.queryByRole("radiogroup", { name: "拡大率" })
    ).not.toBeInTheDocument()
    expect(
      within(effortGroup).getByRole("radio", { name: "高" })
    ).toHaveAttribute("aria-checked", "true")
    expect(
      within(modeGroup).getByRole("radio", { name: "バッチ" })
    ).toHaveAttribute("aria-checked", "true")

    await userEvent.click(
      within(modeGroup).getByRole("radio", { name: "すぐに" })
    )
    expect(
      within(modeGroup).getByRole("radio", { name: "すぐに" })
    ).toHaveAttribute("aria-checked", "true")
    // 選んでいるものをもう一度押しても外れない
    await userEvent.click(
      within(modeGroup).getByRole("radio", { name: "すぐに" })
    )
    expect(
      within(modeGroup).getByRole("radio", { name: "すぐに" })
    ).toHaveAttribute("aria-checked", "true")
  })

  it("Effort を受け付けないモデル（Haiku 4.5）では Effort を選ばせない", () => {
    renderRunDialog({
      ...SETTINGS,
      defaultModels: {
        ...SETTINGS.defaultModels,
        anthropic: "claude-haiku-4-5",
      },
    })
    const effortGroup = screen.getByRole("radiogroup", { name: "Effort" })
    within(effortGroup)
      .getAllByRole("radio")
      .forEach((effortButton) => expect(effortButton).toBeDisabled())
    expect(
      screen.getByText(/このモデルは Effort を受け付けません/)
    ).toBeTruthy()
  })
})

describe("絞り込みのボタン（一覧表示と共通）", () => {
  beforeEach(() => vi.clearAllMocks())

  it("7つの状態を並べ、表示中の状態を押された形で出し、押すとその状態を切り替える", async () => {
    installFakeElectronApi({ isUnlocked: true })
    const onToggleFilter = vi.fn()
    renderWithProviders(
      <ScoringStatusFilterButtons
        filterSettings={{ unscored: true, correct: false }}
        onToggleFilter={onToggleFilter}
      />
    )
    const buttons = screen.getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual([
      "未採点",
      "正答",
      "部分点",
      "保留",
      "誤答",
      "無答",
      "Wマーク",
    ])
    expect(screen.getByRole("button", { name: "未採点" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    // 設定に無い状態は表示していないものとして扱う
    expect(screen.getByRole("button", { name: "Wマーク" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    await userEvent.click(screen.getByRole("button", { name: "無答" }))
    expect(onToggleFilter).toHaveBeenCalledWith("no_answer")
  })
})

function RunHistoryHarness({ runs }: { runs: AiGradingRunRow[] }) {
  const [chosenRunId, setChosenRunId] = useState<string | null>(null)
  return (
    <AiRunHistorySection
      runs={runs}
      questionScores={[]}
      cropRegionId={CROP_REGION_ID}
      currentUserId={CURRENT_USER_ID}
      points={4}
      promptNumberById={new Map([["prompt-1", 1]])}
      chosenRunId={chosenRunId}
      onChooseRun={setChosenRunId}
    />
  )
}

describe("採点の履歴", () => {
  it("新しい順に並べ、目的ごとの番号と採点指示の番号で呼び、押した実行を選んだ形で出し、「答案ごとに最新の判定」で戻せる", async () => {
    installFakeElectronApi({ isUnlocked: true })
    renderWithProviders(
      <RunHistoryHarness
        runs={[
          makeRun({
            id: "run-older",
            createdAt: new Date("2026-10-01T00:00:00.000Z"),
          }),
          makeRun({
            id: "run-check",
            purpose: "check",
            createdAt: new Date("2026-10-01T12:00:00.000Z"),
          }),
          makeRun({
            id: "run-newer",
            model: "claude-haiku-4-5",
            mode: "batch",
            createdAt: new Date("2026-10-02T00:00:00.000Z"),
          }),
        ]}
      />
    )
    const group = screen.getByRole("group", { name: "一覧に出す実行" })
    const rows = within(group).getAllByRole("button")
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent("答案ごとに最新の判定")
    expect(rows[0]).toHaveAttribute("aria-pressed", "true")
    expect(rows[1]).toHaveTextContent("claude-haiku-4-5 / 中 / バッチ")
    expect(rows[1]).toHaveTextContent("採点 2・指示 1")
    expect(rows[2]).toHaveTextContent("チェック 1・指示 1")
    expect(rows[3]).toHaveTextContent("採点 1・指示 1")

    await userEvent.click(rows[3])
    expect(rows[3]).toHaveAttribute("aria-pressed", "true")
    expect(rows[0]).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(rows[0])
    expect(rows[0]).toHaveAttribute("aria-pressed", "true")
  })
})
