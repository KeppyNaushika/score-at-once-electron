// @vitest-environment jsdom
/**
 * 07 の「AI採点」モード（docs/vlm-grading-design.md §9-1・§10）。
 *
 * ここで固定すること:
 * - 同意して API キーを保存した事業者が無ければ「AI採点」は採点モードの選択肢に出ない
 * - 実行ダイアログは選び方ごとの件数を出し、白紙の答案は数えない（送らない）
 * - 「採用」は選んだ答案すべての表示中の試行を、開いているタブのもの（採点なら点だけ、
 *   アノテーションなら求めた／教員が直した朱書きだけ）として書き込みへ渡す。
 *   点を書くときに採点済みが混じれば件数を示して1回だけ確かめる
 * - 採用前の朱書きは保存しない下書きとして個別表示の編集の部品に渡し、採用後は保存済みを直す
 *
 * window.electronAPI は偽物で、ネットワークにも実際のキーにも実データにも触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiAdoptOverwriteDialog } from "@/components/exams/07-score-at-once/AiGrading/AiAdoptOverwriteDialog"
import { AiBulkActionsBar } from "@/components/exams/07-score-at-once/AiGrading/AiBulkActionsBar"
import { AiGradingRunDialog } from "@/components/exams/07-score-at-once/AiGrading/AiGradingRunDialog"
import { AiOwnScoringSection } from "@/components/exams/07-score-at-once/AiGrading/AiOwnScoringSection"
import { AiRunHistorySection } from "@/components/exams/07-score-at-once/AiGrading/AiRunHistorySection"
import { AiSelectedAnswerSection } from "@/components/exams/07-score-at-once/AiGrading/AiSelectedAnswerSection"
import { useAiAnnotationDrafts } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiAnnotationDrafts"
import { useAiAttemptNavigation } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiAttemptNavigation"
import { useAiOwnScoring } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiOwnScoring"
import {
  type AdoptKind,
  useAiSelectionAdoption,
} from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiSelectionAdoption"
import type {
  AiGradingAnswer,
  AiGradingRunRow,
} from "@/components/exams/07-score-at-once/AiGrading/types"
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

  it("自分が未採点の答案の件数を出し、確認に件数と送信先を出す（採点済み・無答の答案は送らない）", async () => {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    const reviewedAnswers = [
      reviewed(makeAnswer("s1")),
      reviewed(makeAnswer("s2")),
      reviewed(makeAnswer("s-no-answer")),
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
        questionScores={[
          makeQuestionScore({ examStudentId: "s-scored" }),
          makeQuestionScore({
            examStudentId: "s-no-answer",
            status: "no_answer",
          }),
        ]}
        currentUserId={CURRENT_USER_ID}
      />
    )

    expect(screen.getByTestId("ai-run-target-summary")).toHaveTextContent(
      "自分が未採点の答案 2 件を送ります"
    )
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

/**
 * 「選んだ答案」の節を、作業場と同じく下書きと採用の状態を持つ親の下で描く。
 * 反映するもの（点か朱書きか）は、作業場では左パネルの反映のタブで決まる。
 * `<` `>` と I のキーも作業場と同じく節の外（`useAiAttemptNavigation`）で付ける
 */
function SelectedAnswerHarness({
  answers,
  selectedExamStudentIds,
  adoptKind = "score",
}: {
  answers: AiGradingAnswer[]
  selectedExamStudentIds: string[]
  adoptKind?: AdoptKind
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
  const singleSelectedItem =
    selectedItems.length === 1 ? selectedItems[0] : null
  const adoption = useAiSelectionAdoption({
    examId: "exam-1",
    cropRegion,
    pageSize: "A4",
    selectedItems,
    adoptKind,
    draftAnnotationsByAttemptId,
    onAdopted: vi.fn(),
  })
  const { showOlderAttempt, showNewerAttempt } = useAiAttemptNavigation({
    singleSelectedItem,
    onChooseAttempt: vi.fn(),
    onAdopt: adoption.requestAdopt,
  })
  return (
    <>
      <AiSelectedAnswerSection
        singleSelectedItem={singleSelectedItem}
        cropRegion={cropRegion}
        pageSize="A4"
        currentUserId={CURRENT_USER_ID}
        studentAnswerImages={answers.map((answer) => answer.studentAnswerImage)}
        promptNumberById={new Map([["prompt-1", 1]])}
        draftAnnotationsByAttemptId={draftAnnotationsByAttemptId}
        onDraftChange={updateDraft}
        onPrevAttempt={showOlderAttempt}
        onNextAttempt={showNewerAttempt}
        onAdopt={adoption.requestAdopt}
        adoptActionLabel={adoption.adoptActionLabel}
        isAdopting={adoption.isAdopting}
        onAnnotationChanged={vi.fn()}
      />
      <AiAdoptOverwriteDialog {...adoption.overwriteDialog} />
    </>
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
      <SelectedAnswerHarness
        answers={[answer]}
        selectedExamStudentIds={["s1"]}
        adoptKind="annotation"
      />
    )
    const editor = screen.getByTestId("ai-annotation-editor")
    expect(editor).toHaveAttribute("data-mode", "draft")
    expect(within(editor).getByText(/途中式/)).toBeInTheDocument()
    // 模範解答は一覧の先頭のマスに出すので、詳細には出さない
    expect(screen.queryByRole("region", { name: "模範解答" })).toBeNull()

    await userEvent.click(
      within(screen.getByLabelText("答案の詳細")).getByRole("button", {
        name: /^朱書きを反映/,
      })
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
      // アノテーション反映のタブでは朱書きだけを書く
      parts: { score: false, annotation: true },
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
      <SelectedAnswerHarness
        answers={[answer]}
        selectedExamStudentIds={["s1"]}
        adoptKind="annotation"
      />
    )
    await userEvent.click(
      screen.getByRole("button", { name: "下書きを動かす" })
    )
    expect(await screen.findByText("直した朱書き")).toBeInTheDocument()

    await userEvent.click(
      within(screen.getByLabelText("答案の詳細")).getByRole("button", {
        name: /^朱書きを反映/,
      })
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
        // アノテーション反映のタブでは朱書きだけを書く
        parts: { score: false, annotation: true },
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
      <SelectedAnswerHarness
        answers={[answer]}
        selectedExamStudentIds={["s1"]}
      />
    )
    expect(screen.getByTestId("ai-annotation-editor")).toHaveAttribute(
      "data-mode",
      "saved"
    )
    expect(screen.queryByRole("button", { name: "下書きを動かす" })).toBeNull()
  })

  it("採点反映では、選んだ答案すべての点を I で採用し、採点済みがあれば件数を示して1回だけ上書きを確かめる", async () => {
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
      <SelectedAnswerHarness
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
        // 既定は採点反映で、点だけを書く
        parts: { score: true, annotation: false },
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

/**
 * 採点反映のタブの「自分で採点」を、作業場と同じくキーの登録ごと描く
 */
function OwnScoringHarness({
  answers,
  selectedExamStudentIds,
  isShortcutEnabled,
  onScored,
}: {
  answers: AiGradingAnswer[]
  selectedExamStudentIds: string[]
  isShortcutEnabled: boolean
  onScored: (examStudentIds: string[]) => void
}) {
  useContextValue("gradingMode", "ai")
  const selectedItems = answers
    .map((answer) => toAiGridItem(reviewed(answer), cropRegion))
    .filter((gridItem) => selectedExamStudentIds.includes(gridItem.id))
  const { scoreSelected, partialScore } = useAiOwnScoring({
    examId: "exam-1",
    currentUserId: CURRENT_USER_ID,
    cropRegion,
    studentAnswerImages: answers.map((answer) => answer.studentAnswerImage),
    questionScores: answers.flatMap((answer) =>
      answer.questionScore ? [answer.questionScore] : []
    ),
    selectedItems,
    isShortcutEnabled,
    onScored,
  })
  return (
    <AiOwnScoringSection
      cropRegion={cropRegion}
      selectedCount={selectedItems.length}
      onScore={scoreSelected}
      partialScore={partialScore}
    />
  )
}

describe("採点反映のタブでの自分の採点（一覧表示と同じキー）", () => {
  beforeEach(() => vi.clearAllMocks())

  const answers = () => [
    makeAnswer("s1"),
    makeAnswer("s2", {
      questionScore: makeQuestionScore({
        examStudentId: "s2",
        status: "incorrect",
      }),
    }),
  ]

  it("E で選んだ答案すべてを自分の正答として書き、書いた答案を知らせる", async () => {
    installFakeElectronApi({ isUnlocked: true })
    const onScored = vi.fn()
    renderWithProviders(
      <OwnScoringHarness
        answers={answers()}
        selectedExamStudentIds={["s1", "s2"]}
        isShortcutEnabled
        onScored={onScored}
      />
    )
    await userEvent.keyboard("e")
    await waitFor(() =>
      expect(fakeScoringApi.setQuestionScore).toHaveBeenCalledWith({
        examStudentId: "s1",
        cropRegionId: CROP_REGION_ID,
        partialScore: null,
        status: "correct",
        userId: CURRENT_USER_ID,
      })
    )
    // 採点済みの答案は自分の行を書き換える
    await waitFor(() =>
      expect(fakeScoringApi.updateQuestionScore).toHaveBeenCalledWith(
        "score-s2",
        { partialScore: null, status: "correct" }
      )
    )
    expect(onScored).toHaveBeenCalledWith(["s1", "s2"])
  })

  it("U は Wマークとして書く", async () => {
    installFakeElectronApi({ isUnlocked: true })
    renderWithProviders(
      <OwnScoringHarness
        answers={answers()}
        selectedExamStudentIds={["s1"]}
        isShortcutEnabled
        onScored={vi.fn()}
      />
    )
    await userEvent.keyboard("u")
    await waitFor(() =>
      expect(fakeScoringApi.setQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({ examStudentId: "s1", status: "double_mark" })
      )
    )
  })

  it("採点反映のタブを開いていなければ、キーでは書かない（ボタンでは書ける）", async () => {
    installFakeElectronApi({ isUnlocked: true })
    const onScored = vi.fn()
    renderWithProviders(
      <OwnScoringHarness
        answers={answers()}
        selectedExamStudentIds={["s1"]}
        isShortcutEnabled={false}
        onScored={onScored}
      />
    )
    await userEvent.keyboard("e")
    expect(fakeScoringApi.setQuestionScore).not.toHaveBeenCalled()
    expect(onScored).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: /正答/ }))
    await waitFor(() =>
      expect(fakeScoringApi.setQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({ examStudentId: "s1", status: "correct" })
      )
    )
  })
})

/** 採点反映のタブのまとめての操作を、作業場と同じく採用の状態を持つ親の下で描く */
function BulkActionsHarness({
  visibleAnswers,
}: {
  visibleAnswers: AiGradingAnswer[]
}) {
  const visibleItems = visibleAnswers.map((answer) =>
    toAiGridItem(reviewed(answer), cropRegion)
  )
  const adoption = useAiSelectionAdoption({
    examId: "exam-1",
    cropRegion,
    pageSize: "A4",
    selectedItems: [],
    adoptKind: "annotation",
    draftAnnotationsByAttemptId: new Map(),
    onAdopted: vi.fn(),
  })
  return (
    <>
      <AiBulkActionsBar
        examId="exam-1"
        cropRegion={cropRegion}
        reviewedAnswers={visibleAnswers.map(reviewed)}
        visibleCount={visibleItems.length}
        onAdoptVisible={() => adoption.requestAdoptVisible(visibleItems)}
        isAdopting={adoption.isAdopting}
      />
      <AiAdoptOverwriteDialog {...adoption.overwriteDialog} />
    </>
  )
}

describe("表示答案を全て採用", () => {
  beforeEach(() => vi.clearAllMocks())

  it("表示中の答案の件数を出し、判定の無い答案は飛ばし、採点済みがあれば1回だけ上書きを確かめて点だけを書く", async () => {
    const aiGrading = installFakeElectronApi({ isUnlocked: true })
    const visibleAnswers = [
      makeAnswer("s1", {
        attempts: [
          makeAttemptWithRun({
            examStudentId: "s1",
            id: "attempt-s1",
            annotationText: "途中式が足りない",
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
    renderWithProviders(<BulkActionsHarness visibleAnswers={visibleAnswers} />)

    await userEvent.click(
      screen.getByRole("button", { name: /表示答案（3件）を全て採用/ })
    )
    expect(aiGrading.adoptAttempts).not.toHaveBeenCalled()
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("採用する 2 件のうち 1 件は採点済みです")

    await userEvent.click(
      within(dialog).getByRole("button", { name: "上書きして採用" })
    )
    await waitFor(() =>
      expect(aiGrading.adoptAttempts).toHaveBeenCalledWith({
        adoptions: [
          { attemptId: "attempt-s1", annotation: expect.anything() },
          { attemptId: "attempt-s2", annotation: null },
        ],
        overwrite: true,
        // 開いているタブによらず、点だけを書く
        parts: { score: true, annotation: false },
      })
    )
    expect(aiGrading.adoptAttempts).toHaveBeenCalledTimes(1)
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

describe("実行の履歴", () => {
  it("新しい順に並べ、押した実行を選んだ形で出し、「最新」で戻せる", async () => {
    installFakeElectronApi({ isUnlocked: true })
    renderWithProviders(
      <RunHistoryHarness
        runs={[
          makeRun({
            id: "run-older",
            createdAt: new Date("2026-10-01T00:00:00.000Z"),
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
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent("最新")
    expect(rows[0]).toHaveAttribute("aria-pressed", "true")
    expect(rows[1]).toHaveTextContent("claude-haiku-4-5 / 中 / バッチ")
    expect(rows[1]).toHaveTextContent("版 1")

    await userEvent.click(rows[2])
    expect(rows[2]).toHaveAttribute("aria-pressed", "true")
    expect(rows[0]).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(rows[0])
    expect(rows[0]).toHaveAttribute("aria-pressed", "true")
  })
})
