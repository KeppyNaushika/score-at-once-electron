// @vitest-environment jsdom
/**
 * 8. 採点確定の類型評価の設問（docs/vlm-grading-design.md §4-8-5）。
 *
 * ここで固定すること:
 * - 採点者の結果は判定・点・類型で束ねる。類型が違えば点数が同じでも別の結果（食い違い）
 * - 数字キーが並び順に類型を選んで確定する（1 が先頭）。確定は類型の id を持ち点は持たない
 * - 正答・誤答・部分点のキーは確定しない（07 と同じ知らせを出す）。保留のキーはそのまま確定する
 * - 確定のボタンは、正答・誤答・部分点の代わりに類型のボタンを並べ、押すとその類型で確定する
 * - 点の採点の設問は、これまでどおり正答で確定し、数字キーは部分点の入力を始める
 * - 答案の下の結果は、類型の記号を類型の色で出す
 *
 * 裁定サマリの取得（useFinalizeData）は差し替え、window.electronAPI は偽物で実データには触れない。
 */

import "../setup"

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { POINT_VERDICT_ON_SCALE_NOTICE } from "@/components/exams/07-score-at-once/ScaleLevel/scaleLevelMessages"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { DecisionVerdictButtons } from "@/components/exams/08-finalize/DecisionVerdictButtons"
import type { DecisionGridItem } from "@/components/exams/08-finalize/hooks/useFinalizeData"
import { useFinalizeScreen } from "@/components/exams/08-finalize/hooks/useFinalizeScreen"
import { useFinalizeShortcuts } from "@/components/exams/08-finalize/hooks/useFinalizeShortcuts"
import { ProposalChips } from "@/components/exams/08-finalize/ProposalChips"
import { groupProposalsByResult } from "@/components/exams/08-finalize/utils/proposedResults"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { PublicUser } from "@/queries/user"
import type {
  ExamDecisionSummary,
  ScoreProposal,
} from "@/types/scoreDecision.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { createQueryWrapper } from "../../helpers/queryWrapper"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")
const CURRENT_USER_ID = "user-1"
const CROP_REGION_ID = "crop-region-1"
const EXAM_PAGE_ID = "exam-page-1"
const EXAM_STUDENT_ID = "exam-student-1"

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

function makeCropRegion(
  scoringMethod: string,
  scoreScaleId: string | null
): QuestionAnswerRegionRow {
  return {
    id: CROP_REGION_ID,
    examPageId: EXAM_PAGE_ID,
    label: "1-(1)",
    type: "QUESTION_ANSWER",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    height: 0.2,
    points: 10,
    orderIndex: 0,
    scoringMethod,
    scoreScaleId,
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

const scaleLevels = [
  { id: "level-a", label: "A", description: "根拠を2つ以上挙げている", score: 10 },
  { id: "level-b", label: "B", description: "根拠を1つ挙げている", score: 6 },
  { id: "level-c", label: "C", description: "根拠が無い", score: 6 },
]

function proposalOf(
  userId: string,
  status: ScoringStatus,
  scaleLevelId: string | null
): ScoreProposal {
  const scaleLevel = scaleLevels.find((level) => level.id === scaleLevelId)
  return {
    questionScoreId: `question-score-${userId}`,
    userId,
    userName: `先生 ${userId}`,
    status,
    partialScore: null,
    scaleLevelId,
    scaleLevel: scaleLevel
      ? { label: scaleLevel.label, score: scaleLevel.score }
      : null,
    scoreValue: scaleLevel?.score ?? null,
    comment: "",
    updatedAt: FIXED_DATE.toISOString(),
  }
}

/** 一覧のいまの設問（テストごとに方式を差し替える） */
let currentCropRegion = makeCropRegion("scale", "scale-1")

function gridItemOf(cropRegion: QuestionAnswerRegionRow): DecisionGridItem {
  return {
    id: EXAM_STUDENT_ID,
    examStudentId: EXAM_STUDENT_ID,
    studentName: "生徒 一",
    imageUrl: "appimg:///answers/1.png",
    status: "unscored",
    maxScore: 10,
    questionRegion: cropRegion,
    customOrder: 0,
    scaleLevelId: null,
    cell: {
      examStudentId: EXAM_STUDENT_ID,
      studentName: "生徒 一",
      cropRegionId: CROP_REGION_ID,
      reason: "conflict",
      proposals: [
        proposalOf("u1", "evaluated", "level-a"),
        proposalOf("u2", "evaluated", "level-b"),
      ],
      decision: null,
      scoreImpact: 10,
    },
  }
}

const summary: ExamDecisionSummary = {
  graderCount: 2,
  conflictCount: 1,
  staleCount: 0,
  decidedCount: 0,
  totalScoreImpact: 10,
  questions: [],
  members: [],
  canDecide: true,
}

vi.mock("@/components/exams/08-finalize/hooks/useFinalizeData", () => ({
  useFinalizeData: () => ({
    exam: undefined,
    summary,
    loading: false,
    error: null,
    refresh: async () => undefined,
    decisionQuestions: [],
    decisionCropRegions: [currentCropRegion],
    currentCropRegionId: CROP_REGION_ID,
    currentQuestion: null,
    currentCropRegion,
    gridItems: [gridItemOf(currentCropRegion)],
    masterAnswerData: null,
  }),
}))

const fakeApi = {
  settings: {
    getUserPreference: vi.fn(async () => null),
    getUserKeyboardShortcuts: vi.fn(async () => ({})),
    listUserScoringStatusColors: vi.fn(async () => []),
    listUserClickScoringActions: vi.fn(async () => []),
  },
  rubric: {
    listScoreScales: vi.fn(async () => [
      { id: "scale-1", name: "記述の組", levels: scaleLevels },
    ]),
  },
  finalizeQuestionScore: vi.fn(async () => ({})),
}

beforeEach(() => {
  vi.clearAllMocks()
  currentCropRegion = makeCropRegion("scale", "scale-1")
  Object.defineProperty(window, "electronAPI", {
    value: fakeApi,
    writable: true,
    configurable: true,
  })
})

function renderWithProviders(ui: ReactNode) {
  const QueryWrapper = createQueryWrapper()
  return render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>{ui}</ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
}

const noop = () => {}

/** 採点確定の画面（ScoreFinalizeMainView）と同じつなぎ方で、キーと確定のボタンだけを載せる */
function FinalizeHarness() {
  const finalizeScreen = useFinalizeScreen("exam-1")
  const { partialScore } = finalizeScreen
  useFinalizeShortcuts({
    decide: finalizeScreen.decide,
    openPartialScoreModal: finalizeScreen.openPartialScoreModal,
    openPendingInput: finalizeScreen.openPendingInput,
    handlePartialScoreInput: finalizeScreen.handleDigitKey,
    handlePartialScoreConfirm: partialScore.handlePartialScoreConfirm,
    handlePartialScoreCancel: partialScore.handlePartialScoreCancel,
    handlePartialScoreBackspace: partialScore.handlePartialScoreBackspace,
    handleGridNavigation: noop,
    handleNextQuestion: noop,
    handlePrevQuestion: noop,
    handleZoomIn: noop,
    handleZoomOut: noop,
    handleResetZoom: noop,
    handleRefresh: noop,
    handleSelectAll: noop,
  })
  return (
    <>
      <span data-testid="partial-input">
        {partialScore.showPartialScoreModal
          ? `入力中:${partialScore.partialScoreInput}`
          : ""}
      </span>
      <DecisionVerdictButtons
        disabled={finalizeScreen.readOnlyReason !== null}
        selectedCount={finalizeScreen.selectedIds.size}
        onDecide={finalizeScreen.decide}
        scaleQuestion={finalizeScreen.scaleQuestion}
        onDecideScaleLevel={finalizeScreen.decideScaleLevel}
      />
    </>
  )
}

async function renderHarness() {
  renderWithProviders(<FinalizeHarness />)
  // キー割当の取得とコマンド登録・コンテキスト反映の effect を落ち着かせる
  await act(async () => {
    await Promise.resolve()
  })
}

/** 類型の組が届き、類型のボタンが並ぶまで待つ */
async function waitForScaleLevelButtons() {
  return within(await screen.findByRole("group", { name: "類型" })).getAllByRole(
    "button"
  )
}

function pressKey(key: string) {
  fireEvent.keyDown(document.body, { key })
}

describe("採点者の結果の束ね方", () => {
  it("類型が違えば点数が同じでも別の結果、同じ類型なら1つに束ねる", () => {
    const results = groupProposalsByResult([
      proposalOf("u1", "evaluated", "level-b"),
      proposalOf("u2", "evaluated", "level-c"),
      proposalOf("u3", "evaluated", "level-b"),
    ])

    expect(results).toHaveLength(2)
    expect(results[0].scaleLevelId).toBe("level-b")
    expect(results[0].proposals.map((proposal) => proposal.userId)).toEqual([
      "u1",
      "u3",
    ])
    expect(results[1].scaleLevelId).toBe("level-c")
    // 点数は同じ 6 点でも、類型 B と C は食い違い
    expect(results[0].scoreValue).toBe(results[1].scoreValue)
  })
})

describe("類型評価の設問の確定", () => {
  it("数字キーが並び順に類型を選んで確定する（点は持たず類型の id を持つ）", async () => {
    await renderHarness()
    await waitForScaleLevelButtons()

    pressKey("2")

    await waitFor(() =>
      expect(fakeApi.finalizeQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({
          examStudentId: EXAM_STUDENT_ID,
          cropRegionId: CROP_REGION_ID,
          verdict: "evaluated",
          score: null,
          scaleLevelId: "level-b",
        })
      )
    )
    expect(screen.getByTestId("partial-input")).toHaveTextContent("")
  })

  it("類型の数を超える数字は何もしない", async () => {
    await renderHarness()
    await waitForScaleLevelButtons()

    pressKey("4")

    await act(async () => {
      await Promise.resolve()
    })
    expect(fakeApi.finalizeQuestionScore).not.toHaveBeenCalled()
    expect(screen.getByTestId("partial-input")).toHaveTextContent("")
  })

  it("正答・誤答・部分点のキーは確定せず、07 と同じ知らせを出す", async () => {
    await renderHarness()
    await waitForScaleLevelButtons()

    pressKey("e") // 正答
    pressKey("o") // 誤答
    pressKey("f") // 部分点

    await act(async () => {
      await Promise.resolve()
    })
    expect(fakeApi.finalizeQuestionScore).not.toHaveBeenCalled()
    expect(screen.getByTestId("partial-input")).toHaveTextContent("")
    expect(toast.info).toHaveBeenCalledWith(POINT_VERDICT_ON_SCALE_NOTICE, {
      id: "scale-point-verdict",
    })
  })

  it("保留のキーは点を入れる欄を開かずに確定する", async () => {
    await renderHarness()
    await waitForScaleLevelButtons()

    pressKey("j")

    await waitFor(() =>
      expect(fakeApi.finalizeQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({
          verdict: "pending",
          score: null,
          scaleLevelId: null,
        })
      )
    )
  })

  it("確定のボタンは、正答・誤答・部分点の代わりに類型のボタンを並べ、押すとその類型で確定する", async () => {
    await renderHarness()
    const levelButtons = await waitForScaleLevelButtons()

    expect(levelButtons).toHaveLength(3)
    expect(levelButtons[0]).toHaveTextContent("A")
    expect(levelButtons[0]).toHaveTextContent("10点")
    for (const label of ["正答", "誤答", "部分点"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    for (const label of ["保留", "無答", "Wマーク"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }

    await userEvent.click(levelButtons[0])

    await waitFor(() =>
      expect(fakeApi.finalizeQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({
          verdict: "evaluated",
          score: null,
          scaleLevelId: "level-a",
        })
      )
    )
  })
})

describe("点の採点の設問の確定", () => {
  it("正答のキーで確定し（類型は持たない）、数字キーは部分点の入力を始める", async () => {
    currentCropRegion = makeCropRegion("points", null)
    await renderHarness()

    expect(screen.queryByRole("group", { name: "類型" })).not.toBeInTheDocument()
    expect(screen.getByText("正答")).toBeInTheDocument()

    pressKey("e")
    await waitFor(() =>
      expect(fakeApi.finalizeQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({
          verdict: "correct",
          score: null,
          scaleLevelId: null,
        })
      )
    )

    pressKey("2")
    await waitFor(() =>
      expect(screen.getByTestId("partial-input")).toHaveTextContent("入力中:2")
    )
    expect(fakeApi.finalizeQuestionScore).toHaveBeenCalledTimes(1)
  })
})

describe("答案の下の結果", () => {
  it("類型評価の結果は類型の記号を類型の色で出す", () => {
    const { container } = renderWithProviders(
      <ProposalChips
        cell={gridItemOf(currentCropRegion).cell}
        scaleAppearanceOfVerdict={(status, scaleLevelId) => {
          const order = scaleLevels.findIndex(
            (level) => level.id === scaleLevelId
          )
          if (status !== "evaluated" || order < 0) return null
          return {
            label: scaleLevels[order].label,
            score: scaleLevels[order].score,
            colors: [
              { bg: "#DBEAFE", text: "#1E3A8A" },
              { bg: "#FEF3C7", text: "#78350F" },
            ][order],
          }
        }}
      />
    )

    const chips = container.querySelectorAll<HTMLElement>("span[title]")
    const levelAChip = [...chips].find((chip) =>
      chip.title.startsWith("類型 A 10点")
    )
    const levelBChip = [...chips].find((chip) =>
      chip.title.startsWith("類型 B 6点")
    )
    if (!levelAChip || !levelBChip) throw new Error("類型の結果が出ていません")
    expect(within(levelAChip).getByText("A")).toBeInTheDocument()
    expect(levelAChip.style.backgroundColor).toBe("rgb(219, 234, 254)")
    expect(levelBChip.style.backgroundColor).toBe("rgb(254, 243, 199)")
  })
})
