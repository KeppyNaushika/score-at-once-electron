// @vitest-environment jsdom
/**
 * 07 の「AI採点」モード（docs/vlm-grading-design.md §9-1・§10）。
 *
 * ここで固定すること:
 * - 同意して API キーを保存した事業者が無ければ「AI採点」は採点モードの選択肢に出ない
 * - 実行ダイアログは選び方ごとの件数を出し、白紙の答案は数えない（送らない）
 * - 「採用」は選んだ答案すべての表示中の試行を、求めた（または教員が直した）注釈つきで
 *   採用の書き込みへ渡す。採点済みが混じれば件数を示して1回だけ確かめる
 * - 採用前の朱書きは保存しない下書きとして個別表示の編集の部品に渡し、採用後は保存済みを直す
 *
 * window.electronAPI は偽物で、ネットワークにも実際のキーにも実データにも触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingRunDialog } from "@/components/exams/07-score-at-once/AiGrading/AiGradingRunDialog"
import { AiGradingSidePanel } from "@/components/exams/07-score-at-once/AiGrading/AiGradingSidePanel"
import { useAiAnnotationDrafts } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiAnnotationDrafts"
import type { AiGradingAnswer } from "@/components/exams/07-score-at-once/AiGrading/types"
import { ALL_STATUSES_VISIBLE } from "@/components/exams/07-score-at-once/AiGrading/utils/aiGridFilter"
import { toAiGridItem } from "@/components/exams/07-score-at-once/AiGrading/utils/aiGridItems"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import type { AnswerIndividualViewProps } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
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
  defaultMode: "realtime",
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
    getModelCatalogs: vi.fn(async () => ({ anthropic: null, openai: null })),
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
    ).toBe("2")
    expect(screen.getByTestId("ai-grading-target-count-all").textContent).toBe(
      "3"
    )
    expect(
      screen.getByTestId("ai-grading-target-count-scoredCheck").textContent
    ).toBe("1")
    expect(
      screen.getByTestId("ai-grading-target-excluded-unscored")
    ).toHaveTextContent("白紙 1件を除く")

    // 開いた時点では選び方を選んでいない。選ぶまで送信の確認へ進めず、費用も出さない
    const targetCards = screen.getAllByRole("radio", {
      name: /件$/,
    })
    expect(targetCards).toHaveLength(6)
    targetCards.forEach((targetCard) =>
      expect(targetCard).toHaveAttribute("aria-checked", "false")
    )
    expect(screen.getByText("採点する答案を選んでください")).toBeTruthy()
    expect(screen.getByText("先に採点する答案を選んでください")).toBeTruthy()
    expect(screen.getByTestId("ai-run-cost-unselected")).toHaveTextContent("—")
    expect(screen.getByRole("button", { name: "送信の確認へ" })).toBeDisabled()
    // 送る答案が0件の選び方は見せるが選ばせない
    expect(
      screen.getByRole("radio", { name: "選択中の答案 0件" })
    ).toBeDisabled()
    expect(aiGrading.estimateRun).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("radio", { name: "未採点のみ 2件" }))
    expect(
      screen.getByRole("radio", { name: "未採点のみ 2件" })
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
})

/** 個別表示の編集の部品の代わり。下書きを描き、「動かした」ことにできる */
vi.mock(
  "@/components/exams/07-score-at-once/ScoringIndividual/AnswerIndividualView",
  () => ({
    default: ({ draftAnnotations }: AnswerIndividualViewProps) => (
      <div data-testid="fake-answer-individual-view">
        {draftAnnotations?.elements.map((drawingAnnotation) => (
          <span key={drawingAnnotation.id}>{drawingAnnotation.text}</span>
        ))}
        {draftAnnotations && (
          <button
            type="button"
            onClick={() =>
              draftAnnotations.setElements((prev) =>
                prev.map((drawingAnnotation) => ({
                  ...drawingAnnotation,
                  x: 0.3,
                  y: 0.25,
                  text: "直した朱書き",
                }))
              )
            }
          >
            下書きを動かす
          </button>
        )}
      </div>
    ),
  })
)

/** 右パネルを、作業場と同じく下書きの状態を持つ親の下で描く */
function SidePanelHarness({
  answers,
  selectedExamStudentIds,
}: {
  answers: AiGradingAnswer[]
  selectedExamStudentIds: string[]
}) {
  const { draftAnnotationsByAttemptId, updateDraft } = useAiAnnotationDrafts()
  // 採点画面が AI採点モードのときに立てる文脈（キーの効く条件）
  useContextValue("gradingMode", "ai")
  const gridItems = answers.map((answer) =>
    toAiGridItem(reviewed(answer), cropRegion)
  )
  const selectedItems = gridItems.filter((gridItem) =>
    selectedExamStudentIds.includes(gridItem.id)
  )
  return (
    <AiGradingSidePanel
      examId="exam-1"
      cropRegion={cropRegion}
      pageSize="A4"
      currentUserId={CURRENT_USER_ID}
      studentAnswerImages={answers.map((answer) => answer.studentAnswerImage)}
      displaySection={{
        display: {
          layoutDirection: "right-down",
          onLayoutDirectionChange: vi.fn(),
          itemsPerLine: [5],
          onItemsPerLineChange: vi.fn(),
          expandMargin: 0,
          onExpandMarginChange: vi.fn(),
          autoScroll: true,
          showStudentNames: true,
          annotationRefreshKey: 0,
          onAnnotationChanged: vi.fn(),
        },
        filterBasis: "ai",
        onFilterBasisChange: vi.fn(),
        filterSettings: ALL_STATUSES_VISIBLE,
        onToggleFilter: vi.fn(),
        selectedCount: selectedItems.length,
        visibleCount: gridItems.length,
        totalCount: gridItems.length,
      }}
      reviewedAnswers={gridItems.map((gridItem) => gridItem.reviewedAnswer)}
      selectedItems={selectedItems}
      singleSelectedItem={selectedItems.length === 1 ? selectedItems[0] : null}
      promptNumberById={new Map([["prompt-1", 1]])}
      onChooseAttempt={vi.fn()}
      draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
      onDraftChange={updateDraft}
      onAdopted={vi.fn()}
      onAnnotationChanged={vi.fn()}
    />
  )
}

describe("実行ダイアログの既定値", () => {
  beforeEach(() => vi.clearAllMocks())

  function renderRunDialog(settings: AiGradingSettings) {
    installFakeElectronApi({ isUnlocked: true })
    renderWithProviders(
      <AiGradingRunDialog
        open
        onOpenChange={vi.fn()}
        examId="exam-1"
        cropRegion={cropRegion}
        settings={settings}
        initialProvider="anthropic"
        unlockedProviders={["anthropic"]}
        prompt={makePrompt()}
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

describe("採用", () => {
  beforeEach(() => vi.clearAllMocks())

  it("答案1つなら、AI の朱書きを下書きとして編集の部品に渡し、直さず採用すれば求めた置き場所で書く", async () => {
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
      <SidePanelHarness answers={[answer]} selectedExamStudentIds={["s1"]} />
    )
    const editor = screen.getByTestId("ai-annotation-editor")
    expect(editor).toHaveAttribute("data-mode", "draft")
    expect(within(editor).getByText(/途中式/)).toBeInTheDocument()
    // 模範解答は一覧の先頭のマスに出すので、詳細には出さない
    expect(screen.queryByRole("region", { name: "模範解答" })).toBeNull()

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
      // 既定の「採用するもの」は点と朱書きの両方
      parts: { score: true, annotation: true },
    })
  })

  it("下書きを直してから採用すると、直した位置と文言で書く", async () => {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    const answer = makeAnswer("s1", {
      attempts: [
        makeAttemptWithRun({
          examStudentId: "s1",
          id: "attempt-s1",
          annotationText: "途中式が足りない",
        }),
      ],
    })
    renderWithProviders(
      <SidePanelHarness answers={[answer]} selectedExamStudentIds={["s1"]} />
    )
    await userEvent.click(
      screen.getByRole("button", { name: "下書きを動かす" })
    )
    expect(await screen.findByText("直した朱書き")).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole("button", { name: /自分の採点として採用/ })
    )
    await waitFor(() =>
      expect(aiGrading.adoptAttempts).toHaveBeenCalledWith({
        adoptions: [
          {
            attemptId: "attempt-s1",
            annotation: { x: 0.3, y: 0.25, text: "直した朱書き", fontSize: 5 },
          },
        ],
        overwrite: false,
        // 既定の「採用するもの」は点と朱書きの両方
        parts: { score: true, annotation: true },
      })
    )
  })

  it("採用済みの判定なら、編集の部品は保存済みの注釈を直す（下書きにしない）", () => {
    installFakeElectronApi({ isUnlocked: true })
    const answer = makeAnswer("s1", {
      questionScore: makeQuestionScore({
        examStudentId: "s1",
        status: "correct",
      }),
      attempts: [
        makeAttemptWithRun({
          examStudentId: "s1",
          id: "attempt-s1",
          status: "correct",
          adoptedAt: new Date("2026-10-02T00:00:00.000Z"),
        }),
      ],
    })
    renderWithProviders(
      <SidePanelHarness answers={[answer]} selectedExamStudentIds={["s1"]} />
    )
    expect(screen.getByTestId("ai-annotation-editor")).toHaveAttribute(
      "data-mode",
      "saved"
    )
    expect(screen.queryByRole("button", { name: "下書きを動かす" })).toBeNull()
  })

  it("選んだ答案すべてを I で採用し、採点済みがあれば件数を示して1回だけ上書きを確かめる", async () => {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    const answers = [
      makeAnswer("s1", {
        attempts: [
          makeAttemptWithRun({
            examStudentId: "s1",
            id: "attempt-s1",
            annotationText: "",
          }),
        ],
      }),
      makeAnswer("s2", {
        questionScore: makeQuestionScore({
          examStudentId: "s2",
          status: "incorrect",
        }),
        attempts: [
          makeAttemptWithRun({
            examStudentId: "s2",
            id: "attempt-s2",
            annotationText: "",
          }),
        ],
      }),
      makeAnswer("s3"),
    ]
    renderWithProviders(
      <SidePanelHarness
        answers={answers}
        selectedExamStudentIds={["s1", "s2", "s3"]}
      />
    )
    // 複数選んでいるときは詳細を出さない
    expect(screen.queryByTestId("ai-annotation-editor")).toBeNull()

    await userEvent.keyboard("i")
    expect(aiGrading.adoptAttempts).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("採用する 2 件のうち 1 件は採点済みです")

    await userEvent.click(
      within(dialog).getByRole("button", { name: "上書きして採用" })
    )
    await waitFor(() =>
      expect(aiGrading.adoptAttempts).toHaveBeenCalledWith({
        adoptions: [
          { attemptId: "attempt-s1", annotation: null },
          { attemptId: "attempt-s2", annotation: null },
        ],
        overwrite: true,
        // 既定の「採用するもの」は点と朱書きの両方
        parts: { score: true, annotation: true },
      })
    )
    expect(aiGrading.adoptAttempts).toHaveBeenCalledTimes(1)
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
