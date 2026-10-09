// @vitest-environment jsdom
/**
 * 07 の AI採点モードの「問いかけ」のタブ（docs/vlm-grading-design.md §3-5・§11）。
 *
 * ここで固定すること:
 * - 2段目の案が、問いかける順（判定を決める案が先）に1つずつ出て、答案の名前と「ほか N名」・
 *   推奨の印の付いた選択肢が並ぶ
 * - 選択の場面で数字を押して Enter で答えると、選んだ選択肢で答えが送られ、次の案へ進む
 * - 0 で「その他」の欄に入り、書いて Enter で指示が送られる
 * - 答えた案は一覧に畳んで残り、押すと開き直して選び直せる
 * - 2段目が失敗していれば「送り直す」が出て、元の1段目から作り直す
 * - 直接採点の設問では、案の前に採点方式を問いかけ、Enter で推奨の方式に変える
 *
 * window.electronAPI は偽物で、実データにもネットワークにも触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiQuestioningPanel } from "@/components/exams/07-score-at-once/AiGrading/AiQuestioningPanel"
import { useAiQuestioningState } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiQuestioningState"
import type {
  AiGradingAttemptRow,
  AiGradingRunRow,
} from "@/components/exams/07-score-at-once/AiGrading/types"
import type { AiRubricProposalRow } from "@/components/exams/07-score-at-once/AiGrading/utils/rubricProposals"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { AiRubricProposalRunRow } from "@/queries/aiGrading"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makeAttempt,
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
    effectKind: "adjust",
    pointDelta: -1,
    setStatus: null,
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
  partialScore: 3,
  confidence: "high",
})
const attemptB = makeAttempt({
  examStudentId: "s-b",
  runId: "grade-run-1",
  status: "partial",
  partialScore: 3,
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

/** 点を加減する案（返ってきた順は先だが、問いかけは判定を決める案の後） */
function makeUnitProposal(responses: ResponseRow[] = []): AiRubricProposalRow {
  return {
    id: "proposal-unit",
    runId: "group-run-1",
    label: "単位が無い",
    description: "答の数値は正しいが単位が無い",
    adviceDraft: "単位を書こう",
    matchedRubricItemId: null,
    sortOrder: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    options: [
      makeOption({
        id: "option-unit-minus1",
        proposalId: "proposal-unit",
        pointDelta: -1,
        rationale: "単位は採点基準にある",
        recommended: true,
      }),
      makeOption({
        id: "option-unit-zero",
        proposalId: "proposal-unit",
        effectKind: "set",
        pointDelta: null,
        setStatus: "incorrect",
        rationale: "単位が無ければ誤答とする",
        sortOrder: 1,
      }),
    ],
    members: [
      makeMember("proposal-unit", attemptA),
      makeMember("proposal-unit", attemptB),
    ],
    responses,
  }
}

/** 判定を決める案（最初に問いかける） */
function makeSignProposal(responses: ResponseRow[] = []): AiRubricProposalRow {
  return {
    id: "proposal-sign",
    runId: "group-run-1",
    label: "移項で符号を誤った",
    description: "−5 を移項したとき符号を変えていない",
    adviceDraft: "移項の符号を見直そう",
    matchedRubricItemId: null,
    sortOrder: 1,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    options: [
      makeOption({
        id: "option-sign-partial",
        proposalId: "proposal-sign",
        effectKind: "set",
        pointDelta: null,
        setStatus: "partial",
        setScore: 2,
        rationale: "方針は正しい",
        recommended: true,
      }),
      makeOption({
        id: "option-sign-incorrect",
        proposalId: "proposal-sign",
        effectKind: "set",
        pointDelta: null,
        setStatus: "incorrect",
        rationale: "答が違う",
        sortOrder: 1,
      }),
    ],
    members: [
      makeMember("proposal-sign", attemptA),
      makeMember("proposal-sign", attemptB),
      makeMember("proposal-sign", attemptC),
    ],
    responses,
  }
}

function makeProposalRun(
  overrides: Partial<AiRubricProposalRunRow> = {}
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
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    endedAt: LATER_DATE,
    createdAt: LATER_DATE,
    updatedAt: LATER_DATE,
    rubricProposals: [makeUnitProposal(), makeSignProposal()],
    ...overrides,
  }
}

const gradeRun: AiGradingRunRow = makeRun({
  id: "grade-run-1",
  purpose: "grade",
  status: "ended",
  attempts: [attemptA, attemptB, attemptC, attemptD],
  createdAt: FIXED_DATE,
})

const answers = ["s-a", "s-b", "s-c", "s-d"].map((examStudentId) =>
  makeAnswer(examStudentId)
)

/** main の代わり。答えは案の行へ積み、取り直すと答えた案として返る */
let proposalRuns: AiRubricProposalRunRow[] = []
const fakeAiGradingApi = {
  listProposals: vi.fn(async () => proposalRuns),
  answerProposal: vi.fn(
    async (input: {
      proposalId: string
      optionId: string | null
      freeText: string
    }) => {
      const response: ResponseRow = {
        id: `response-${fakeAiGradingApi.answerProposal.mock.calls.length}`,
        proposalId: input.proposalId,
        optionId: input.optionId,
        freeText: input.freeText,
        resultRubricItemId: null,
        createdAt: LATER_DATE,
        updatedAt: LATER_DATE,
      }
      proposalRuns = proposalRuns.map((run) => ({
        ...run,
        rubricProposals: run.rubricProposals.map((proposal) =>
          proposal.id === input.proposalId
            ? { ...proposal, responses: [...proposal.responses, response] }
            : proposal
        ),
      }))
      return { response, touchedRows: [] }
    }
  ),
  startGroupingRun: vi.fn(async () => null),
}
const fakeRubricApi = {
  listItems: vi.fn(async () => []),
  listApplications: vi.fn(async () => []),
  getRecalculationSource: vi.fn(async () => null),
  setScoringMethod: vi.fn(async () => ({})),
  writeScores: vi.fn(),
  getAdviceSource: vi.fn(async () => null),
  syncAdviceAnnotations: vi.fn(),
  measureInk: vi.fn(async () => []),
}

function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: { getUserKeyboardShortcuts: vi.fn(async () => ({})) },
      aiGrading: fakeAiGradingApi,
      rubric: fakeRubricApi,
      getQuestionScoresByCropRegionId: vi.fn(async () => []),
    },
    writable: true,
    configurable: true,
  })
}

const onStartNextRound = vi.fn()

function QuestioningHarness({
  cropRegion,
  runs,
}: {
  cropRegion: QuestionAnswerRegionRow
  runs: AiGradingRunRow[]
}) {
  const questioning = useAiQuestioningState({
    examId: "exam-1",
    cropRegionId: cropRegion.id,
    runs,
    answers,
  })
  return (
    <AiQuestioningPanel
      examId="exam-1"
      cropRegion={cropRegion}
      currentUserId={CURRENT_USER_ID}
      questionScores={[]}
      studentAnswerImages={answers.map((answer) => answer.studentAnswerImage)}
      pageSize="A4"
      questioning={questioning}
      onScored={vi.fn()}
      onStartNextRound={onStartNextRound}
      onShowAdoption={vi.fn()}
      selectedJudgement={null}
    />
  )
}

function renderPanel(
  cropRegion = makeCropRegion("deduction"),
  runs: AiGradingRunRow[] = [gradeRun]
) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>
          <QuestioningHarness cropRegion={cropRegion} runs={runs} />
        </ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  proposalRuns = [makeProposalRun()]
  installFakeElectronApi()
})

describe("案の問いかけ", () => {
  it("判定を決める案から出し、答案の名前・ほか N名・推奨の選択肢を並べる", async () => {
    renderPanel()

    const question = await screen.findByRole("region", {
      name: "問いかけ: 移項で符号を誤った",
    })
    // 確信度の低い順に名前を2つ、残りは人数で
    expect(question).toHaveTextContent("3名：生徒 s-c、生徒 s-b、ほか1名")
    const options = within(question).getByRole("list", { name: "選択肢" })
    expect(within(options).getByText("部分点 2点")).toBeInTheDocument()
    expect(within(options).getByText("推奨")).toBeInTheDocument()
    expect(within(options).getByText("方針は正しい")).toBeInTheDocument()
    // どの案にも入らない答案は「判断できない」に出る
    expect(
      screen.getByRole("region", { name: "どの案にも入らない答案" })
    ).toHaveTextContent("生徒 s-d")
  })

  it("数字で選んで Enter で答えると、選んだ選択肢を送って次の案へ進む", async () => {
    renderPanel()
    await screen.findByRole("region", { name: "問いかけ: 移項で符号を誤った" })

    await userEvent.keyboard(" ")
    await userEvent.keyboard("2")
    await userEvent.keyboard("{Enter}")

    await waitFor(() =>
      expect(fakeAiGradingApi.answerProposal).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: "option-sign-incorrect",
        freeText: "",
        examStudentIds: ["s-a", "s-b", "s-c"],
      })
    )
    expect(
      await screen.findByRole("region", { name: "問いかけ: 単位が無い" })
    ).toBeInTheDocument()
  })

  it("0 で「その他」の欄に入り、書いて Enter で指示を送る", async () => {
    renderPanel()
    await screen.findByRole("region", { name: "問いかけ: 移項で符号を誤った" })

    await userEvent.keyboard(" ")
    await userEvent.keyboard("0")
    expect(screen.getByRole("textbox", { name: "その他の指示" })).toHaveFocus()
    await userEvent.keyboard("途中式があれば部分点{Enter}")

    await waitFor(() =>
      expect(fakeAiGradingApi.answerProposal).toHaveBeenCalledWith({
        proposalId: "proposal-sign",
        optionId: null,
        freeText: "途中式があれば部分点",
        examStudentIds: ["s-a", "s-b", "s-c"],
      })
    )
    expect(
      await screen.findByRole("region", { name: "問いかけ: 単位が無い" })
    ).toBeInTheDocument()
  })

  it("答えた案は一覧に残り、押すと開き直して選び直せる", async () => {
    renderPanel()
    await screen.findByRole("region", { name: "問いかけ: 移項で符号を誤った" })
    await userEvent.keyboard(" ")
    await userEvent.keyboard("{Enter}")
    await screen.findByRole("region", { name: "問いかけ: 単位が無い" })

    const list = screen.getByRole("list", { name: "項目の案の一覧" })
    const answered = await within(list).findByRole("button", {
      name: /移項で符号を誤った.*部分点 2点/,
    })
    await userEvent.click(answered)

    const reopened = await screen.findByRole("region", {
      name: "問いかけ: 移項で符号を誤った",
    })
    expect(within(reopened).getByText("いまの答え")).toBeInTheDocument()
    await userEvent.click(
      within(reopened).getByRole("button", { name: /誤答/ })
    )
    await userEvent.click(
      within(reopened).getByRole("button", {
        name: "この選択肢にして次の案へ",
      })
    )
    await waitFor(() =>
      expect(fakeAiGradingApi.answerProposal).toHaveBeenLastCalledWith(
        expect.objectContaining({
          proposalId: "proposal-sign",
          optionId: "option-sign-incorrect",
        })
      )
    )
  })

  it("全部の案に答えて「その他」の指示があれば、次の往復を案内する", async () => {
    proposalRuns = [
      makeProposalRun({
        rubricProposals: [
          makeUnitProposal([
            {
              id: "response-unit",
              proposalId: "proposal-unit",
              optionId: null,
              freeText: "単位は問わない",
              resultRubricItemId: null,
              createdAt: LATER_DATE,
              updatedAt: LATER_DATE,
            },
          ]),
          makeSignProposal([
            {
              id: "response-sign",
              proposalId: "proposal-sign",
              optionId: "option-sign-partial",
              freeText: "",
              resultRubricItemId: null,
              createdAt: LATER_DATE,
              updatedAt: LATER_DATE,
            },
          ]),
        ],
      }),
    ]
    renderPanel()

    await userEvent.click(
      await screen.findByRole("button", { name: "次の往復を実行する" })
    )
    expect(onStartNextRound).toHaveBeenCalled()
  })
})

describe("2段目の状態", () => {
  it("2段目が失敗していれば「送り直す」で元の1段目から作り直す", async () => {
    proposalRuns = [makeProposalRun({ status: "failed", rubricProposals: [] })]
    renderPanel()

    await userEvent.click(
      await screen.findByRole("button", { name: "送り直す" })
    )
    await waitFor(() =>
      expect(fakeAiGradingApi.startGroupingRun).toHaveBeenCalledWith(
        "grade-run-1"
      )
    )
  })

  it("2段目が走っている間は、そのことを示す", async () => {
    proposalRuns = [
      makeProposalRun({ status: "in_progress", rubricProposals: [] }),
    ]
    renderPanel()
    expect(
      await screen.findByText("判定から項目の案を作っています")
    ).toBeInTheDocument()
  })
})

describe("直接採点の設問", () => {
  it("案の前に採点方式を問いかけ、Enter で推奨の減点方式に変える", async () => {
    renderPanel(makeCropRegion("points"))

    const question = await screen.findByRole("region", {
      name: "問いかけ: 採点方式",
    })
    expect(within(question).getByText("推奨")).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "問いかけ: 移項で符号を誤った" })
    ).not.toBeInTheDocument()

    await userEvent.keyboard(" ")
    await userEvent.keyboard("{Enter}")
    await waitFor(() =>
      expect(fakeRubricApi.setScoringMethod).toHaveBeenCalledWith(
        CROP_REGION_ID,
        "deduction"
      )
    )
    expect(fakeAiGradingApi.answerProposal).not.toHaveBeenCalled()
  })
})
