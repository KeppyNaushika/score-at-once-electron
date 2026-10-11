// @vitest-environment jsdom
/**
 * 07 の AI採点モードの問いかけ（docs/vlm-grading-design.md §3-5・§3-10・§11-4）。
 *
 * ここで固定すること:
 * - 問い・選択肢・記録・見直しは左パネルに出し、**中央は答案の一覧のまま**（問いかけを中央に出さない）
 * - 一覧は、いまの問いの答案に確信度の低い順で絞る（スイッチで外せる）。↑↓ で焦点のある選択肢・
 *   決めた答えで付く予定の点は、そのマスに斜線（未確定）で出し、確定すると斜線は消える
 * - 1問ずつ問いと選択肢が出る。↑↓ で選び Enter で決めると、
 *   決めたことは下書きとして AI の層に書かれ、記録に「見出し → 決めたこと」で残り、次の問いへ進む
 * - **確定するまで教員の層には何も書かない**。見直しの「確定する」で初めて全部書く
 * - 問いの一覧はすべての問いを常に出し（未回答も）、行のどこを押しても（Enter・Space でも）その問いを開く。
 *   見直しに件数と、採点済みの答案を置き換える知らせが出る（問いごとの内訳の表は出さない）
 * - 選択肢のクリックは選ぶだけ（ダブルクリックでも決めない）。カードの「次へ」「戻る」と、問いかけのタブを
 *   開いている間いつでも効く Ctrl/⌘+Enter・Ctrl/⌘+Shift+Enter（選択の場面の外・欄の中・1件ずつ採点の中でも。
 *   変換中・部分点の入力欄を開いている間・タブを閉じているあいだは効かない）
 * - 「1件ずつ自分で採点する」は一覧の答案を ←→ で移り（クリックでも移れる）、採点キー（数字は部分点）で
 *   点を付ける（下書き。一覧に斜線で出る）
 * - 「その他」の欄は ↓ で入り、1行目の ↑ で戻る（2行目の ↑ は戻らない）。素の Enter・変換中の
 *   Enter では送らず、Ctrl/⌘+Enter で決める。中身は問いを移っても残り、確定のとき「その他」を
 *   選んでいない問いの中身は捨てる
 * - 直接採点の設問に点を加減する案があれば、最初に採点方式を問い、方式は確定のときに変える
 * - AI 採点チェックでは「同じ答えに違う点」と「先生と AI の食い違い」を同じ形で出し、
 *   直すと決めた答案だけを確定で書く
 *
 * window.electronAPI は偽物で、実データにもネットワークにも触れない。
 */

import "../setup"

import { useQuery } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useMemo, useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingGrid } from "@/components/exams/07-score-at-once/AiGrading/AiGradingGrid"
import { AiQuestioningPanel } from "@/components/exams/07-score-at-once/AiGrading/AiQuestioningPanel"
import { useAiCheckQuestions } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiCheckQuestions"
import { useAiGradingQuestions } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGradingQuestions"
import { useAiGridSelection } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGridSelection"
import { useAiGridViewSettings } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGridViewSettings"
import { useAiQuestioning } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiQuestioning"
import type {
  AiGradingAnswer,
  AiGradingAttemptRow,
  AiGradingRunRow,
  AiGridDisplaySettings,
} from "@/components/exams/07-score-at-once/AiGrading/types"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import type { AiRubricProposalRow } from "@/components/exams/07-score-at-once/AiGrading/utils/rubricProposals"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import { DEFAULT_KEYBINDINGS } from "@/lib/scoringKeybindings"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"
import {
  aiGradingRunsQuery,
  type AiRubricProposalRunRow,
} from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makeAttempt,
  makeQuestionScore,
  makeRun,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")
const LATER_DATE = new Date("2026-10-01T01:00:00.000Z")

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

function makeCropRegion(scoringMethod: string): QuestionAnswerRegionRow {
  return {
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
    scoringMethod,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    examPage: {
      id: EXAM_PAGE_ID,
      examId: "exam-1",
      pageNumber: 1,
      imagePath: "master/page1.png",
      pageSize: "A4",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
    cropSubtotals: [],
  }
}

type OptionRow = AiRubricProposalRow["options"][number]
type ResponseRow = AiRubricProposalRow["responses"][number]

function makeOption(
  overrides: Partial<OptionRow> & { id: string; proposalId: string }
): OptionRow {
  return {
    effectKind: "set",
    pointDelta: null,
    setStatus: "incorrect",
    setScore: null,
    rationale: "",
    recommended: false,
    sortOrder: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

function makeMember(proposalId: string, attempt: AiGradingAttemptRow) {
  return {
    id: `member-${proposalId}-${attempt.examStudentId}`,
    proposalId,
    attemptId: attempt.id,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    attempt,
  }
}

// 1段目の試行（確信度の低い順に並ぶ: s-c → s-b → s-a）
const attemptA = makeAttempt({
  examStudentId: "s-a",
  runId: "grade-run-1",
  status: "partial",
  partialScore: 2,
  confidence: "high",
})
const attemptB = makeAttempt({
  examStudentId: "s-b",
  runId: "grade-run-1",
  status: "partial",
  partialScore: 2,
  confidence: "medium",
})
const attemptC = makeAttempt({
  examStudentId: "s-c",
  runId: "grade-run-1",
  status: "incorrect",
  confidence: "low",
})
/** どの案にも入らない答案 */
const attemptD = makeAttempt({
  examStudentId: "s-d",
  runId: "grade-run-1",
  status: "incorrect",
  confidence: "low",
})

/** 判定を決める案（答案3件） */
function makeSignProposal(adjust = false): AiRubricProposalRow {
  return {
    id: "proposal-sign",
    runId: "group-run-1",
    label: "移項で符号を誤った",
    description: "−5 を移項したとき符号を変えていない",
    adviceDraft: "移項の符号を見直そう",
    matchedRubricItemId: null,
    sortOrder: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    options: [
      makeOption({
        id: "option-sign-partial",
        proposalId: "proposal-sign",
        setStatus: "partial",
        setScore: 2,
        rationale: "方針は正しい",
        recommended: true,
      }),
      adjust
        ? makeOption({
            id: "option-sign-minus1",
            proposalId: "proposal-sign",
            effectKind: "adjust",
            pointDelta: -1,
            setStatus: null,
            rationale: "1点引く",
            sortOrder: 1,
          })
        : makeOption({
            id: "option-sign-incorrect",
            proposalId: "proposal-sign",
            rationale: "答が違う",
            sortOrder: 1,
          }),
    ],
    members: [
      makeMember("proposal-sign", attemptA),
      makeMember("proposal-sign", attemptB),
      makeMember("proposal-sign", attemptC),
    ],
    responses: [],
  }
}

/** 正答を決める案（答案1件） */
function makeUnitProposal(): AiRubricProposalRow {
  return {
    id: "proposal-unit",
    runId: "group-run-1",
    label: "単位まで正しい",
    description: "",
    adviceDraft: "",
    matchedRubricItemId: null,
    sortOrder: 1,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    options: [
      makeOption({
        id: "option-unit-correct",
        proposalId: "proposal-unit",
        setStatus: "correct",
        recommended: true,
      }),
    ],
    members: [makeMember("proposal-unit", attemptA)],
    responses: [],
  }
}

function makeProposalRun(
  rubricProposals: AiRubricProposalRow[]
): AiRubricProposalRunRow {
  return {
    id: "group-run-1",
    userId: CURRENT_USER_ID,
    promptId: "prompt-1",
    purpose: "group",
    templateVersion: "1",
    provider: "anthropic",
    model: "claude-opus-5-5",
    effort: "medium",
    mode: "realtime",
    status: "ended",
    externalBatchId: null,
    submittedClientId: "client-1",
    imageScale: 1,
    points: 4,
    resultPromptId: null,
    notes: "",
    questioningScoringMethod: "",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    endedAt: LATER_DATE,
    createdAt: LATER_DATE,
    updatedAt: LATER_DATE,
    rubricProposals,
  }
}

// ── main の代わり（行を積み、取り直すと届く） ─────────────────────────
let proposalRuns: AiRubricProposalRunRow[] = []
let runs: AiGradingRunRow[] = []
let responseCount = 0

const updateProposal = (
  proposalId: string,
  update: (proposal: AiRubricProposalRow) => AiRubricProposalRow
) => {
  proposalRuns = proposalRuns.map((run) => ({
    ...run,
    rubricProposals: run.rubricProposals.map((proposal) =>
      proposal.id === proposalId ? update(proposal) : proposal
    ),
  }))
}

const fakeAiGradingApi = {
  listRuns: vi.fn(async () => runs),
  listProposals: vi.fn(async () => proposalRuns),
  startGroupingRun: vi.fn(async () => null),
  recordProposalDraft: vi.fn(
    async (input: {
      proposalId: string
      optionId: string | null
      freeText: string
      manualScores: {
        attemptId: string
        status: string
        partialScore: number | null
      }[]
    }) => {
      responseCount += 1
      const responseId = `response-${responseCount}`
      const response: ResponseRow = {
        id: responseId,
        proposalId: input.proposalId,
        optionId: input.optionId,
        freeText: input.freeText,
        resultRubricItemId: null,
        committedAt: null,
        createdAt: LATER_DATE,
        updatedAt: LATER_DATE,
        scores: input.manualScores.map((score, scoreIndex) => ({
          id: `${responseId}-score-${scoreIndex}`,
          responseId,
          attemptId: score.attemptId,
          status: score.status,
          partialScore: score.partialScore,
          createdAt: LATER_DATE,
          updatedAt: LATER_DATE,
        })),
      }
      updateProposal(input.proposalId, (proposal) => ({
        ...proposal,
        responses: [...proposal.responses, response],
      }))
      return response
    }
  ),
  recordAttemptResponses: vi.fn(
    async (input: {
      responses: {
        attemptId: string
        choice: string
        status: string | null
        partialScore: number | null
      }[]
    }) => {
      runs = runs.map((run) => ({
        ...run,
        attempts: run.attempts.map((attempt) => {
          const written = input.responses.filter(
            (response) => response.attemptId === attempt.id
          )
          return {
            ...attempt,
            responses: [
              ...attempt.responses,
              ...written.map((response) => {
                responseCount += 1
                return {
                  id: `attempt-response-${responseCount}`,
                  ...response,
                  committedAt: null,
                  createdAt: LATER_DATE,
                  updatedAt: LATER_DATE,
                }
              }),
            ],
          }
        }),
      }))
      return []
    }
  ),
  setQuestioningScoringMethod: vi.fn(
    async (input: { runId: string; scoringMethod: string }) => {
      proposalRuns = proposalRuns.map((run) =>
        run.id === input.runId
          ? { ...run, questioningScoringMethod: input.scoringMethod }
          : run
      )
      return {}
    }
  ),
  commitProposalResponse: vi.fn(
    async (input: { responseId: string; examStudentIds: string[] }) => {
      proposalRuns = proposalRuns.map((run) => ({
        ...run,
        rubricProposals: run.rubricProposals.map((proposal) => ({
          ...proposal,
          responses: proposal.responses.map((response) =>
            response.id === input.responseId && response.optionId !== null
              ? { ...response, committedAt: LATER_DATE }
              : response
          ),
        })),
      }))
      return { response: {}, touchedRows: [] }
    }
  ),
  writeQuestioningScores: vi.fn(async () => 0),
  markQuestioningCommitted: vi.fn(
    async (_input: {
      proposalResponseIds: string[]
      attemptResponseIds: string[]
    }) => undefined
  ),
}
const fakeRubricApi = {
  listItems: vi.fn(async () => []),
  listApplications: vi.fn(async () => []),
  getRecalculationSource: vi.fn(async () => null),
  setScoringMethod: vi.fn(async () => ({})),
  writeScores: vi.fn(async () => ({
    writtenQuestionScoreIds: [],
    deletedQuestionScoreIds: [],
    skippedOverriddenIds: [],
  })),
  getAdviceSource: vi.fn(async () => null),
  syncAdviceAnnotations: vi.fn(),
  measureInk: vi.fn(async () => []),
}
const fakeScoringApi = {
  setQuestionScore: vi.fn(async () => ({})),
  updateQuestionScore: vi.fn(async () => ({})),
}

function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: {
        getUserKeyboardShortcuts: vi.fn(async () => ({})),
        getUserPreference: vi.fn(async () => null),
        listUserScoringStatusColors: vi.fn(async () => []),
      },
      drawing: { getByCropRegion: vi.fn(async () => []) },
      aiGrading: fakeAiGradingApi,
      rubric: fakeRubricApi,
      getQuestionScoresByCropRegionId: vi.fn(async () => []),
      setQuestionScore: fakeScoringApi.setQuestionScore,
      updateQuestionScore: fakeScoringApi.updateQuestionScore,
    },
    writable: true,
    configurable: true,
  })
}

/** 教員の層へ書く口が1つも呼ばれていないか */
function expectNoTeacherLayerWrites() {
  expect(fakeAiGradingApi.commitProposalResponse).not.toHaveBeenCalled()
  expect(fakeAiGradingApi.writeQuestioningScores).not.toHaveBeenCalled()
  expect(fakeAiGradingApi.markQuestioningCommitted).not.toHaveBeenCalled()
  expect(fakeRubricApi.setScoringMethod).not.toHaveBeenCalled()
  expect(fakeRubricApi.writeScores).not.toHaveBeenCalled()
  expect(fakeScoringApi.setQuestionScore).not.toHaveBeenCalled()
  expect(fakeScoringApi.updateQuestionScore).not.toHaveBeenCalled()
}

const onRegrade = vi.fn()

const display: AiGridDisplaySettings = {
  layoutDirection: "right-down",
  onLayoutDirectionChange: () => undefined,
  itemsPerLine: [4],
  onItemsPerLineChange: () => undefined,
  expandMargin: 0,
  onExpandMarginChange: () => undefined,
  autoScroll: false,
  showStudentNames: true,
  annotationRefreshKey: 0,
}

/** AI採点の作業場と同じつなぎ方（左パネルの問いかけと、中央の答案の一覧） */
function QuestioningHarness({
  mode,
  cropRegion,
  answers,
}: {
  mode: "grade" | "check"
  cropRegion: QuestionAnswerRegionRow
  answers: AiGradingAnswer[]
}) {
  useContextValue("gradingMode", "ai")
  // 左パネルのタブを問いかけ以外（プロンプト・採点反映）へ移したときの代わり
  const [isTabOpen, setIsTabOpen] = useState(true)
  const { data: loadedRuns = [] } = useQuery(
    aiGradingRunsQuery("exam-1", cropRegion.id, false)
  )
  const grading = useAiGradingQuestions({
    examId: "exam-1",
    cropRegion,
    runs: loadedRuns,
  })
  const check = useAiCheckQuestions({
    examId: "exam-1",
    cropRegion,
    runs: loadedRuns,
    answers,
  })
  const selected = mode === "grade" ? grading : check
  const questioning = useAiQuestioning({
    mode: isTabOpen ? mode : null,
    examId: "exam-1",
    cropRegion,
    currentUserId: CURRENT_USER_ID,
    pageSize: "A4",
    studentAnswerImages: answers.map((answer) => answer.studentAnswerImage),
    states: selected.states,
    persistDecision: selected.persistDecision,
    ownScoreOf: check.ownScoreOf,
    proposals:
      mode === "grade" ? (grading.proposalRun?.rubricProposals ?? []) : [],
  })
  const reviewedAnswers = useMemo(
    () =>
      answers.map((answer) => ({
        answer,
        review: reviewAnswer(answer, {
          chosenAttemptIdByExamStudentId: new Map(),
          selectedPromptId: "prompt-1",
          points: cropRegion.points,
        }),
      })),
    [answers, cropRegion.points]
  )
  const viewSettings = useAiGridViewSettings()
  const grid = useAiGridSelection({
    cropRegion,
    reviewedAnswers,
    layoutDirection: display.layoutDirection,
    itemsPerLine: display.itemsPerLine,
    viewSettings,
    pinnedExamStudentIds: questioning.pinnedExamStudentIds,
  })
  const selectionOverride = questioning.gridSelectionOverride
  const selectedIds = selectionOverride?.selectedIds ?? grid.selectedIds
  return (
    <div>
      <button type="button" onClick={() => setIsTabOpen(!isTabOpen)}>
        {isTabOpen ? "プロンプトのタブへ" : "問いかけのタブへ"}
      </button>
      <aside aria-label="左パネル">
        {isTabOpen && (
          <AiQuestioningPanel
            mode={mode}
            questioning={questioning}
            cropRegion={cropRegion}
            onRun={() => undefined}
            statusNotice={null}
            emptyMessage="問いはありません"
            notes=""
            onRegrade={mode === "grade" ? onRegrade : undefined}
          />
        )}
      </aside>
      <section aria-label="答案と AI の判定">
        <output data-testid="selection">
          {grid.visibleIds
            .filter((examStudentId) => selectedIds.has(examStudentId))
            .join(",")}
        </output>
        <AiGradingGrid
          cropRegion={cropRegion}
          currentUserId={CURRENT_USER_ID}
          pageSize="A4"
          display={display}
          visibleItems={grid.visibleItems}
          visibleIds={grid.visibleIds}
          selectedIds={selectedIds}
          onSelect={
            selectionOverride
              ? (id) => selectionOverride.select(id)
              : grid.handleSelectAnswer
          }
          onReplaceSelection={(ids) =>
            selectionOverride
              ? ids.forEach(selectionOverride.select)
              : grid.setSelection(new Set(ids))
          }
          totalCount={reviewedAnswers.length}
          draftStatusByExamStudentId={questioning.draftStatusByExamStudentId}
        />
      </section>
    </div>
  )
}

const gradeAnswers = () =>
  ["s-a", "s-b", "s-c", "s-d"].map((examStudentId) =>
    makeAnswer(
      examStudentId,
      // s-a は採点済み（AI 採点に送っても置き換える）
      examStudentId === "s-a"
        ? {
            questionScore: makeQuestionScore({
              examStudentId,
              status: "correct",
            }),
          }
        : {}
    )
  )

function renderView({
  mode = "grade",
  cropRegion = makeCropRegion("deduction"),
  answers = gradeAnswers(),
}: {
  mode?: "grade" | "check"
  cropRegion?: QuestionAnswerRegionRow
  answers?: AiGradingAnswer[]
} = {}) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>
          <QuestioningHarness
            mode={mode}
            cropRegion={cropRegion}
            answers={answers}
          />
        </ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

const card = (title: string) =>
  within(screen.getByRole("complementary", { name: "左パネル" })).findByRole(
    "region",
    { name: `問いかけ: ${title}` }
  )
const center = () => screen.getByRole("region", { name: "答案と AI の判定" })
/** 中央の一覧に並んでいる答案（受験者。模範解答は除く） */
const gridAnswerIds = () =>
  [...center().querySelectorAll<HTMLElement>("[data-answer-id]")]
    .map((cell) => cell.dataset.answerId ?? "")
    .filter((answerId) => !answerId.startsWith("master-"))
const cellOf = (examStudentId: string) => {
  const cell = center().querySelector<HTMLElement>(
    `[data-answer-id="${examStudentId}"]`
  )
  if (!cell) throw new Error(`答案 ${examStudentId} のマスが描かれていません`)
  return cell
}
/** マスに斜線で出している、確定すると付く予定の状態（無ければ null） */
const draftStatusOf = (examStudentId: string) =>
  cellOf(examStudentId).dataset.draftStatus ?? null
const selectedIdsShown = () => screen.getByTestId("selection").textContent
/** 問いの一覧の、その問いの行（行の全体がボタン） */
const logRow = async (title: string) =>
  within(await screen.findByRole("list", { name: "問いの一覧" })).findByRole(
    "button",
    { name: (accessibleName) => accessibleName.startsWith(title) }
  )
const focusedOption = () =>
  within(screen.getByRole("listbox", { name: "選択肢" })).getByRole("option", {
    selected: true,
  })

beforeEach(() => {
  vi.clearAllMocks()
  responseCount = 0
  proposalRuns = [makeProposalRun([makeSignProposal(), makeUnitProposal()])]
  runs = [
    makeRun({
      id: "grade-run-1",
      purpose: "grade",
      status: "ended",
      attempts: [attemptA, attemptB, attemptC, attemptD],
      createdAt: FIXED_DATE,
    }),
  ]
  installFakeElectronApi()
})

describe("AI 採点の問いかけ", () => {
  it("問いと推奨の選択肢は左パネルに出し、中央は答案の一覧のまま（問いの答案に確信度の低い順で絞る）", async () => {
    renderView()
    const question = await card("移項で符号を誤った（3件）")
    const options = within(question).getByRole("listbox", { name: "選択肢" })
    expect(within(options).getByText("部分点 2点")).toBeInTheDocument()
    expect(within(options).getByText("推奨")).toBeInTheDocument()
    expect(
      within(options).getByText("1件ずつ自分で採点する")
    ).toBeInTheDocument()
    expect(
      within(options).getByText("その他：再採点を指示する")
    ).toBeInTheDocument()
    expect(focusedOption()).toHaveTextContent("部分点 2点")

    // 中央に問いかけは出さず、一覧が問いの答案を確信度の低い順に並べる
    expect(
      within(center()).queryByRole("region", { name: /問いかけ/ })
    ).toBeNull()
    expect(within(center()).queryByRole("listbox")).toBeNull()
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-c", "s-b", "s-a"]))
  })

  it("↑↓ で移した選択肢で付く点を、問いの答案のマスに斜線で出す。決めても残り、確定すると消える", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    // 推奨（部分点 2点）に焦点がある
    await waitFor(() => expect(draftStatusOf("s-c")).toBe("partial"))
    expect(draftStatusOf("s-b")).toBe("partial")
    // 採点済みの答案も置き換えるので、塗りの上に斜線を重ねる
    expect(draftStatusOf("s-a")).toBe("partial")

    await userEvent.keyboard("{ArrowDown}")
    expect(draftStatusOf("s-c")).toBe("incorrect")
    // 「1件ずつ自分で採点する」はまだ点を付けていないので斜線なし
    await userEvent.keyboard("{ArrowDown}")
    expect(draftStatusOf("s-c")).toBeNull()
    await userEvent.keyboard("{ArrowUp}{Enter}")

    // 次の問い（答案は s-a だけ）。絞り込みを外すと、決めた問いの答案にも斜線が残っている
    await card("単位まで正しい（1件）")
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-a"]))
    expect(draftStatusOf("s-a")).toBe("correct")
    await userEvent.click(screen.getByRole("switch", { name: "一覧を絞る" }))
    await waitFor(() => expect(draftStatusOf("s-c")).toBe("incorrect"))
    expect(draftStatusOf("s-b")).toBe("incorrect")
    expectNoTeacherLayerWrites()

    await userEvent.keyboard("{Enter}")
    await card("どの案にも入らない答案（1件）")
    // 「このままにする」は点を付けない
    expect(draftStatusOf("s-d")).toBeNull()
    await userEvent.keyboard("{Enter}")
    const review = await screen.findByRole("region", { name: "見直し" })
    await userEvent.click(
      within(review).getByRole("button", { name: "確定する" })
    )
    await waitFor(() =>
      expect(fakeAiGradingApi.commitProposalResponse).toHaveBeenCalledTimes(2)
    )
    // 確定した答えは斜線で出さない（自分の採点の塗りになる）
    await waitFor(() => expect(draftStatusOf("s-c")).toBeNull())
    expect(draftStatusOf("s-b")).toBeNull()
  })

  it("一覧の絞り込みはスイッチで外せ、外すといつもの絞り込みに戻る", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-c", "s-b", "s-a"]))
    const narrowSwitch = screen.getByRole("switch", { name: "一覧を絞る" })
    expect(narrowSwitch).toBeChecked()

    await userEvent.click(narrowSwitch)
    // 既定の絞り込み（自分が未採点）。採点済みの s-a は出ず、どの案にも入らない s-d も出る
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-b", "s-c", "s-d"]))
    await userEvent.click(narrowSwitch)
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-c", "s-b", "s-a"]))
  })

  it("Enter で決めると下書きだけを書き、記録に残って次の問いへ。教員の層には何も書かない", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    await userEvent.keyboard("{ArrowDown}{Enter}")

    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: "option-sign-incorrect",
        freeText: "",
        manualScores: [],
      })
    )
    await card("単位まで正しい（1件）")
    const log = await screen.findByRole("list", { name: "問いの一覧" })
    expect(
      await within(log).findByText("→ 誤答 0点", { exact: false })
    ).toBeInTheDocument()
    expectNoTeacherLayerWrites()
  })

  it("問いの一覧の行を押すと戻れ、いまの答えに焦点がある", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await card("単位まで正しい（1件）")
    await userEvent.click(await logRow("移項で符号を誤った（3件）"))
    await card("移項で符号を誤った（3件）")
    expect(focusedOption()).toHaveTextContent("誤答 0点")
    // Ctrl/⌘+Shift+Enter でも前へ戻れる（先頭なら動かない）
    await userEvent.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}")
    expect(await card("移項で符号を誤った（3件）")).toBeInTheDocument()
  })

  it("全部答えると見直しに件数と置き換えの知らせが出て、確定で初めて全部書く", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    await userEvent.keyboard("{Enter}")
    await card("単位まで正しい（1件）")
    await userEvent.keyboard("{Enter}")
    // どの案にも入らない答案は、1件ずつ自分で採点する（e で正答）
    await card("どの案にも入らない答案（1件）")
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await userEvent.keyboard("e")
    await userEvent.keyboard("{Enter}")

    const review = await screen.findByRole("region", { name: "見直し" })
    await waitFor(() =>
      expect(review).toHaveTextContent("4件の採点を確定します")
    )
    expect(within(review).getByRole("note")).toHaveTextContent(
      "このうち 1件は採点済みの答案です。確定すると、ここで決めた点に置き換わります。"
    )
    expectNoTeacherLayerWrites()

    await userEvent.click(
      within(review).getByRole("button", { name: "確定する" })
    )
    await waitFor(() =>
      expect(fakeAiGradingApi.markQuestioningCommitted).toHaveBeenCalled()
    )
    expect(fakeAiGradingApi.commitProposalResponse).toHaveBeenCalledTimes(2)
    expect(fakeAiGradingApi.commitProposalResponse).toHaveBeenCalledWith({
      responseId: "response-1",
      examStudentIds: ["s-c", "s-b", "s-a"],
    })
    expect(fakeAiGradingApi.writeQuestioningScores).toHaveBeenCalledWith({
      cropRegionId: CROP_REGION_ID,
      scores: [{ examStudentId: "s-d", status: "correct", partialScore: null }],
    })
    expect(fakeAiGradingApi.markQuestioningCommitted).toHaveBeenCalledWith({
      proposalResponseIds: [],
      attemptResponseIds: [expect.any(String)],
    })
  })

  it("「1件ずつ自分で採点する」は一覧の答案を ←→・クリックで移り、採点キーと数字の部分点で付けて、Enter で下書きにする", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-c", "s-b", "s-a"]))
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}")
    // 一覧では焦点の答案を選んでいるものとして出す
    await waitFor(() => expect(selectedIdsShown()).toBe("s-c"))

    // o（誤答）で付けると、一覧に斜線で出て次の答案へ
    await userEvent.keyboard("o")
    expect(draftStatusOf("s-c")).toBe("incorrect")
    expect(selectedIdsShown()).toBe("s-b")
    // → で次へ、← で戻る
    await userEvent.keyboard("{ArrowRight}")
    expect(selectedIdsShown()).toBe("s-a")
    await userEvent.keyboard("{ArrowLeft}")
    expect(selectedIdsShown()).toBe("s-b")
    // マスのクリックでも移れる
    await userEvent.click(cellOf("s-a"))
    expect(selectedIdsShown()).toBe("s-a")
    await userEvent.click(cellOf("s-b"))
    expect(selectedIdsShown()).toBe("s-b")
    // 数字で部分点の入力欄を開き、f で部分点として付ける
    await userEvent.keyboard("3")
    await userEvent.keyboard("f")
    await waitFor(() => expect(draftStatusOf("s-b")).toBe("partial"))
    // 付けていない答案に斜線は出さない
    expect(draftStatusOf("s-a")).toBeNull()
    expectNoTeacherLayerWrites()

    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: null,
        freeText: "",
        manualScores: [
          { attemptId: attemptC.id, status: "incorrect", partialScore: null },
          { attemptId: attemptB.id, status: "partial", partialScore: 3 },
        ],
      })
    )
    await card("単位まで正しい（1件）")
    expectNoTeacherLayerWrites()
  })

  it("「その他」の欄: ↓ で入り、1行目の ↑ で戻り、2行目の ↑ では戻らない。中身は問いを移っても残る", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    const textbox = screen.getByRole("textbox", { name: "再採点への指示" })
    await waitFor(() => expect(textbox).toHaveFocus())

    // 素の Enter は改行（送らない）
    await userEvent.keyboard("途中式があれば{Enter}部分点")
    expect(textbox).toHaveValue("途中式があれば\n部分点")
    // 2行目の ↑ は普通の行の移動（欄に残る）
    fireEvent.keyDown(textbox, { key: "ArrowUp" })
    expect(textbox).toHaveFocus()
    // 1行目の ↑ で上の選択肢（1件ずつ自分で採点する）へ戻る
    ;(textbox as HTMLTextAreaElement).setSelectionRange(2, 2)
    fireEvent.keyDown(textbox, { key: "ArrowUp" })
    expect(textbox).not.toHaveFocus()
    expect(focusedOption()).toHaveTextContent("1件ずつ自分で採点する")
    // もう一度 ↓ で入ると、中身は残っている
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "再採点への指示" })
      ).toHaveValue("途中式があれば\n部分点")
    )
    expect(fakeAiGradingApi.recordProposalDraft).not.toHaveBeenCalled()
  })

  it("「その他」の欄: 変換中の Enter では送らず、Ctrl+Enter で再採点への指示として決める", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    const textbox = screen.getByRole("textbox", { name: "再採点への指示" })
    await waitFor(() => expect(textbox).toHaveFocus())
    await userEvent.keyboard("単位は問わない")
    fireEvent.keyDown(textbox, { key: "Enter", isComposing: true })
    fireEvent.keyDown(textbox, { key: "Enter", keyCode: 229 })
    fireEvent.keyDown(textbox, {
      key: "Enter",
      ctrlKey: true,
      isComposing: true,
    })
    expect(fakeAiGradingApi.recordProposalDraft).not.toHaveBeenCalled()

    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: null,
        freeText: "単位は問わない",
        manualScores: [],
      })
    )
    expect(await card("単位まで正しい（1件）")).toBeInTheDocument()
  })

  it("確定のとき、「その他」を選んでいない問いの欄の中身は捨てる", async () => {
    renderView()
    await card("移項で符号を誤った（3件）")
    // 欄に書いたが、選択肢で決める
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    const textbox = screen.getByRole("textbox", { name: "再採点への指示" })
    await waitFor(() => expect(textbox).toHaveFocus())
    await userEvent.keyboard("あとで消える指示")
    ;(textbox as HTMLTextAreaElement).setSelectionRange(0, 0)
    fireEvent.keyDown(textbox, { key: "ArrowUp" })
    await userEvent.keyboard("{ArrowUp}{ArrowUp}{Enter}")
    await card("単位まで正しい（1件）")
    await userEvent.keyboard("{Enter}")
    await card("どの案にも入らない答案（1件）")
    await userEvent.keyboard("{Enter}")

    const review = await screen.findByRole("region", { name: "見直し" })
    await userEvent.click(
      within(review).getByRole("button", { name: "確定する" })
    )
    await waitFor(() =>
      expect(fakeAiGradingApi.commitProposalResponse).toHaveBeenCalled()
    )

    await userEvent.click(await logRow("移項で符号を誤った（3件）"))
    await card("移項で符号を誤った（3件）")
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "再採点への指示" })
      ).toHaveValue("")
    )
  })

  it("直接採点の設問に点を加減する案があれば、最初に採点方式を問い、方式は確定のときに変える", async () => {
    proposalRuns = [makeProposalRun([makeSignProposal(true)])]
    renderView({ cropRegion: makeCropRegion("points") })
    await card("採点方式")
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(fakeAiGradingApi.setQuestioningScoringMethod).toHaveBeenCalledWith(
        { runId: "group-run-1", scoringMethod: "deduction" }
      )
    )
    await card("移項で符号を誤った（3件）")
    expectNoTeacherLayerWrites()
  })
})

describe("問いかけの「戻る」「次へ」と問いの一覧", () => {
  const SIGN = "移項で符号を誤った（3件）"
  const UNIT = "単位まで正しい（1件）"
  const OUTSIDE = "どの案にも入らない答案（1件）"
  const nextKeyLabel = formatKeyForDisplay(
    DEFAULT_KEYBINDINGS["choice.nextQuestion"],
    "Alt"
  )
  const prevKeyLabel = formatKeyForDisplay(
    DEFAULT_KEYBINDINGS["choice.prevQuestion"],
    "Alt"
  )
  const nextButton = async (title: string) =>
    within(await card(title)).getByRole("button", { name: /^次へ/ })
  const backButton = async (title: string) =>
    within(await card(title)).getByRole("button", { name: /^戻る/ })
  const optionDraft = (optionId: string) => ({
    proposalId: "proposal-sign",
    optionId,
    freeText: "",
    manualScores: [],
  })

  it("選択肢はクリックでもダブルクリックでも決めず、焦点を移すだけ", async () => {
    renderView()
    await card(SIGN)
    const options = screen.getByRole("listbox", { name: "選択肢" })
    await userEvent.click(within(options).getByText("誤答 0点"))
    expect(focusedOption()).toHaveTextContent("誤答 0点")
    await userEvent.dblClick(within(options).getByText("部分点 2点"))
    expect(focusedOption()).toHaveTextContent("部分点 2点")
    expect(await card(SIGN)).toBeInTheDocument()
    expect(fakeAiGradingApi.recordProposalDraft).not.toHaveBeenCalled()
  })

  it("「次へ」は Enter と同じく決めて次へ、「戻る」は前の問いへ。先頭では「戻る」を押せず、ボタンにキーを添える", async () => {
    renderView()
    await card(SIGN)
    expect(await backButton(SIGN)).toBeDisabled()
    expect(await backButton(SIGN)).toHaveTextContent(prevKeyLabel)
    expect(await nextButton(SIGN)).toHaveTextContent(nextKeyLabel)

    await userEvent.click(within(await card(SIGN)).getByText("誤答 0点"))
    await userEvent.click(await nextButton(SIGN))
    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith(
        optionDraft("option-sign-incorrect")
      )
    )
    expect(await backButton(UNIT)).toBeEnabled()
    await userEvent.click(await backButton(UNIT))
    await card(SIGN)
    expect(focusedOption()).toHaveTextContent("誤答 0点")
  })

  it("「その他」で欄が空なら「次へ」は押せず理由を出し、書けば指示を残して次へ", async () => {
    renderView()
    await card(SIGN)
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    const textbox = screen.getByRole("textbox", { name: "再採点への指示" })
    await waitFor(() => expect(textbox).toHaveFocus())
    expect(await nextButton(SIGN)).toBeDisabled()
    expect(await card(SIGN)).toHaveTextContent("指示を書くと次へ進めます")

    await userEvent.keyboard("途中式を見て")
    expect(await nextButton(SIGN)).toBeEnabled()
    await userEvent.click(await nextButton(SIGN))
    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: null,
        freeText: "途中式を見て",
        manualScores: [],
      })
    )
    expect(await card(UNIT)).toBeInTheDocument()
  })

  it("「1件ずつ自分で採点する」では、ボタンで始めて、付けた下書きで「次へ」決める", async () => {
    renderView()
    await card(SIGN)
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-c", "s-b", "s-a"]))
    await userEvent.keyboard("{ArrowDown}{ArrowDown}")
    await userEvent.click(
      within(await card(SIGN)).getByRole("button", {
        name: /^1件ずつ採点を始める/,
      })
    )
    await waitFor(() => expect(selectedIdsShown()).toBe("s-c"))
    await userEvent.keyboard("o")
    await userEvent.click(await nextButton(SIGN))
    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: null,
        freeText: "",
        manualScores: [
          { attemptId: attemptC.id, status: "incorrect", partialScore: null },
        ],
      })
    )
    expect(await card(UNIT)).toBeInTheDocument()
  })

  it("見直しには内訳の表を出さず、「戻る」（と Ctrl+Shift+Enter）で最後の問いへ", async () => {
    renderView()
    await card(SIGN)
    await userEvent.keyboard("{Enter}")
    await card(UNIT)
    await userEvent.keyboard("{Enter}")
    await card(OUTSIDE)
    await userEvent.keyboard("{Enter}")
    const review = await screen.findByRole("region", { name: "見直し" })
    expect(within(review).queryByRole("table")).toBeNull()
    const back = within(review).getByRole("button", { name: /^戻る/ })
    expect(back).toHaveTextContent(prevKeyLabel)
    await userEvent.click(back)
    await card(OUTSIDE)
    await userEvent.keyboard("{Enter}")
    await screen.findByRole("region", { name: "見直し" })
    await userEvent.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}")
    expect(await card(OUTSIDE)).toBeInTheDocument()
  })

  it("Ctrl/⌘+Enter・Ctrl/⌘+Shift+Enter は選択の場面を抜けていても、「その他」の欄の中でも効く", async () => {
    renderView()
    await card(SIGN)
    // Esc で選択の場面を抜けても
    await userEvent.keyboard("{Escape}")
    await userEvent.keyboard("{ArrowDown}")
    expect(focusedOption()).toHaveTextContent("部分点 2点")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith(
        optionDraft("option-sign-partial")
      )
    )
    await card(UNIT)
    await userEvent.keyboard("{Meta>}{Shift>}{Enter}{/Shift}{/Meta}")
    await card(SIGN)

    // 欄の中で ⌘+Enter
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    const textbox = screen.getByRole("textbox", { name: "再採点への指示" })
    await waitFor(() => expect(textbox).toHaveFocus())
    await userEvent.keyboard("単位は問わない")
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}")
    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: null,
        freeText: "単位は問わない",
        manualScores: [],
      })
    )
    await card(UNIT)
    // 欄の中で Ctrl+Shift+Enter
    await userEvent.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}")
    await card(SIGN)
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "再採点への指示" })
      ).toHaveFocus()
    )
    await userEvent.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}")
    // 先頭なので動かない
    expect(await card(SIGN)).toBeInTheDocument()
  })

  it("1件ずつ採点の最中も Ctrl+Enter で下書きを決めて次へ。部分点の入力欄を開いている間は効かない", async () => {
    renderView()
    await card(SIGN)
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-c", "s-b", "s-a"]))
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}")
    await waitFor(() => expect(selectedIdsShown()).toBe("s-c"))
    await userEvent.keyboard("o")
    // 数字で部分点の入力欄を開いている間は効かない
    await userEvent.keyboard("3")
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    expect(fakeAiGradingApi.recordProposalDraft).not.toHaveBeenCalled()
    await userEvent.keyboard("{Escape}")
    expect(await card(SIGN)).toBeInTheDocument()

    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await waitFor(() =>
      expect(fakeAiGradingApi.recordProposalDraft).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: null,
        freeText: "",
        manualScores: [
          { attemptId: attemptC.id, status: "incorrect", partialScore: null },
        ],
      })
    )
    expect(await card(UNIT)).toBeInTheDocument()
  })

  it("日本語入力の変換中のキーは拾わない", async () => {
    renderView()
    await card(SIGN)
    fireEvent.keyDown(document.body, {
      key: "Enter",
      ctrlKey: true,
      isComposing: true,
    })
    fireEvent.keyDown(document.body, {
      key: "Enter",
      metaKey: true,
      keyCode: 229,
    })
    fireEvent.keyDown(document.body, { key: "Enter", isComposing: true })
    fireEvent.keyDown(document.body, {
      key: "Enter",
      ctrlKey: true,
      shiftKey: true,
      isComposing: true,
    })
    expect(fakeAiGradingApi.recordProposalDraft).not.toHaveBeenCalled()
    expect(await card(SIGN)).toBeInTheDocument()
  })

  it("問いかけのタブを閉じているあいだは Ctrl+Enter が効かない", async () => {
    renderView()
    await card(SIGN)
    await userEvent.click(
      screen.getByRole("button", { name: "プロンプトのタブへ" })
    )
    await userEvent.keyboard("{Control>}{Enter}{/Control}")
    await userEvent.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}")
    expect(fakeAiGradingApi.recordProposalDraft).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole("button", { name: "問いかけのタブへ" })
    )
    expect(await card(SIGN)).toBeInTheDocument()
  })

  it("問いの一覧はすべての問いを常に出し、行のどこを押しても（Enter・Space でも）その問いを開く", async () => {
    renderView()
    await card(SIGN)
    const log = await screen.findByRole("list", { name: "問いの一覧" })
    const rows = within(log).getAllByRole("button")
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent(SIGN)
    expect(rows[0]).toHaveAttribute("aria-current", "step")
    expect(rows[1]).toHaveTextContent(`${UNIT}→ 未回答`)
    expect(rows[2]).toHaveTextContent(`${OUTSIDE}→ 未回答`)
    expect(within(log).queryByRole("button", { name: /変える/ })).toBeNull()

    // 決めたことの部分を押しても開く
    await userEvent.click(within(rows[2]).getByText("→ 未回答"))
    await card(OUTSIDE)
    expect(await logRow(OUTSIDE)).toHaveAttribute("aria-current", "step")
    expect(await logRow(SIGN)).not.toHaveAttribute("aria-current")

    // 焦点を当てて Enter・Space でも開く
    ;(await logRow(UNIT)).focus()
    await userEvent.keyboard("{Enter}")
    await card(UNIT)
    ;(await logRow(SIGN)).focus()
    await userEvent.keyboard(" ")
    await card(SIGN)
    expect(fakeAiGradingApi.recordProposalDraft).not.toHaveBeenCalled()

    // 答えると、その行に決めたことが出る（行は減らない）
    await userEvent.keyboard("{Enter}")
    await card(UNIT)
    await waitFor(async () =>
      expect(await logRow(SIGN)).toHaveTextContent("→ 部分点 2点")
    )
    expect(within(log).getAllByRole("button")).toHaveLength(3)
  })
})

describe("AI 採点チェックの問いかけ", () => {
  /** 同じ答え「緑葉体」に正答と誤答、s-d は先生が正答・AI が誤答 */
  function setUpCheckRun() {
    const checkAttempt = (
      examStudentId: string,
      transcription: string,
      status: "correct" | "incorrect",
      confidence: string
    ) =>
      makeAttempt({
        id: `check-${examStudentId}`,
        examStudentId,
        runId: "check-run-1",
        status,
        transcription,
        observation: `${examStudentId} の所見`,
        confidence,
      })
    runs = [
      makeRun({
        id: "check-run-1",
        purpose: "check",
        status: "ended",
        attempts: [
          checkAttempt("s-a", "緑葉体", "incorrect", "high"),
          checkAttempt("s-b", "緑 葉体", "incorrect", "high"),
          checkAttempt("s-c", "葉緑体", "correct", "high"),
          checkAttempt("s-d", "葉緑素", "incorrect", "medium"),
        ],
      }),
    ]
    proposalRuns = []
    const statusOf: Record<string, "correct" | "incorrect"> = {
      "s-a": "correct",
      "s-b": "incorrect",
      "s-c": "correct",
      "s-d": "correct",
    }
    return Object.entries(statusOf).map(([examStudentId, status]) =>
      makeAnswer(examStudentId, {
        questionScore: makeQuestionScore({ examStudentId, status }),
      })
    )
  }

  it("同じ答えに違う点の組と、先生と AI の食い違いを出し、直すと付く点だけを一覧に斜線で出す", async () => {
    renderView({ mode: "check", answers: setUpCheckRun() })
    await card("同じ答え「緑葉体」に、違う点が付いています")
    // 一覧は組の答案に絞る（あなたの点はマスの塗りで見える）
    await waitFor(() => expect(gridAnswerIds()).toEqual(["s-a", "s-b"]))
    // AI の判定（誤答）と同じものが推奨
    expect(focusedOption()).toHaveTextContent("すべて誤答 0点")
    // 誤答に直すと変わるのは s-a だけ（s-b はもう誤答）
    expect(draftStatusOf("s-a")).toBe("incorrect")
    expect(draftStatusOf("s-b")).toBeNull()

    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(fakeAiGradingApi.recordAttemptResponses).toHaveBeenCalledWith({
        responses: [
          {
            attemptId: "check-s-a",
            choice: "rescore",
            status: "incorrect",
            partialScore: null,
          },
          {
            attemptId: "check-s-b",
            choice: "rescore",
            status: "incorrect",
            partialScore: null,
          },
        ],
      })
    )
    const disagreement = await card(
      "あなたは正答 4点、AI は誤答 0点と判定しました"
    )
    expect(disagreement).toHaveTextContent("AI は「s-d の所見」と見ています。")
    expect(focusedOption()).toHaveTextContent("誤答 0点 に直す")
    // このままにする
    await userEvent.keyboard("{ArrowDown}{Enter}")

    const review = await screen.findByRole("region", { name: "見直し" })
    // 直すのは s-a だけ（s-b はもう誤答）。置き換えの知らせはチェックでは出さない
    await waitFor(() =>
      expect(review).toHaveTextContent("1件の採点を確定します")
    )
    expect(within(review).queryByRole("note")).toBeNull()
    expectNoTeacherLayerWrites()

    await userEvent.click(
      within(review).getByRole("button", { name: "確定する" })
    )
    await waitFor(() =>
      expect(fakeAiGradingApi.writeQuestioningScores).toHaveBeenCalledWith({
        cropRegionId: CROP_REGION_ID,
        scores: [
          { examStudentId: "s-a", status: "incorrect", partialScore: null },
        ],
      })
    )
    await waitFor(() =>
      expect(fakeAiGradingApi.markQuestioningCommitted).toHaveBeenCalled()
    )
    expect(fakeAiGradingApi.commitProposalResponse).not.toHaveBeenCalled()
  })
})
