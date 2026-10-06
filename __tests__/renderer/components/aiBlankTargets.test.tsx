// @vitest-environment jsdom
/**
 * 07 の AI採点モード、採点反映のタブの「白紙を無答に」の対象を一覧で見せる。
 *
 * ここで固定すること:
 * - インク率で白紙と測った答案のマスにだけ「白紙」のバッジを出す。境界帯は破線の
 *   「白紙?」で分けて出し、書き込みのある答案には何も出さない
 * - 「白紙を無答に」の件数は、絞り込みで隠れている答案も含めて数える（隠れている件数も示す）
 * - 「対象を選ぶ」で選択がちょうど対象の答案になり、隠れていた対象も一覧に出る
 * - 確認の後に書くのも同じ対象
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiBulkActionsBar } from "@/components/exams/07-score-at-once/AiGrading/AiBulkActionsBar"
import { AiGradingGrid } from "@/components/exams/07-score-at-once/AiGrading/AiGradingGrid"
import { useAiGridSelection } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGridSelection"
import { useAiGridViewSettings } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGridViewSettings"
import type {
  AiGradingAnswer,
  AiGridDisplaySettings,
} from "@/components/exams/07-score-at-once/AiGrading/types"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import { blankUnscoredExamStudentIds } from "@/components/exams/07-score-at-once/AiGrading/utils/blankAnswers"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
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
  makeQuestionScore,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z")

const currentUser: PublicUser = {
  id: CURRENT_USER_ID,
  username: "teacher",
  name: "テスト先生",
  role: "teacher",
  passcodeType: null,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
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
  onAnnotationChanged: () => undefined,
}

/** AI の判定を持つ答案（既定の絞り込み＝自分が未採点で AI の判定がある、に残る） */
function judgedAnswer(
  examStudentId: string,
  overrides: Partial<AiGradingAnswer> = {}
): AiGradingAnswer {
  return makeAnswer(examStudentId, {
    attempts: [
      makeAttemptWithRun({ examStudentId, id: `attempt-${examStudentId}` }),
    ],
    ...overrides,
  })
}

/**
 * - written: 書き込みあり（印なし）
 * - blank: 白紙・未採点（対象）
 * - blank-hidden: 白紙・未採点だが AI の判定が無く、既定の絞り込みで隠れる（対象）
 * - borderline: 境界帯（対象外。破線の印）
 * - blank-scored: 白紙だが自分が採点済み（対象外。既定の絞り込みで隠れる）
 */
const answers: AiGradingAnswer[] = [
  judgedAnswer("written"),
  judgedAnswer("blank", { inkMeasurement: makeInk({ blankness: "blank" }) }),
  makeAnswer("blank-hidden", {
    inkMeasurement: makeInk({ blankness: "blank" }),
  }),
  judgedAnswer("borderline", {
    inkMeasurement: makeInk({ blankness: "borderline" }),
  }),
  judgedAnswer("blank-scored", {
    inkMeasurement: makeInk({ blankness: "blank" }),
    questionScore: makeQuestionScore({
      examStudentId: "blank-scored",
      status: "correct",
    }),
  }),
]

const reviewedAnswers = answers.map((answer) => ({
  answer,
  review: reviewAnswer(answer, {
    chosenAttemptIdByExamStudentId: new Map(),
    selectedPromptId: "prompt-1",
    points: 4,
  }),
}))

function installFakeElectronApi() {
  const aiGrading = {
    adoptBlankAnswers: vi.fn(
      async (input: { examStudentIds: readonly string[] }) =>
        input.examStudentIds.map((examStudentId) => ({
          examStudentId,
          outcome: "adopted",
        }))
    ),
  }
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: {
        getUserPreference: vi.fn(async () => null),
        getUserKeyboardShortcuts: vi.fn(async () => ({})),
        listUserScoringStatusColors: vi.fn(async () => []),
      },
      drawing: { getByCropRegion: vi.fn(async () => []) },
      aiGrading,
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

/** 作業場と同じつなぎ方（選択は useAiGridSelection、一覧は AiGradingGrid） */
function BlankTargetsHarness() {
  const viewSettings = useAiGridViewSettings()
  const grid = useAiGridSelection({
    cropRegion,
    reviewedAnswers,
    layoutDirection: display.layoutDirection,
    itemsPerLine: display.itemsPerLine,
    viewSettings,
  })
  return (
    <>
      <output data-testid="visible">{grid.visibleIds.join(",")}</output>
      <output data-testid="selection">
        {grid.visibleIds
          .filter((examStudentId) => grid.selectedIds.has(examStudentId))
          .join(",")}
      </output>
      <AiBulkActionsBar
        examId="exam-1"
        cropRegion={cropRegion}
        reviewedAnswers={reviewedAnswers}
        visibleCount={grid.visibleItems.length}
        visibleIds={grid.visibleIds}
        onSelectBlankTargets={grid.revealAndSelect}
        onAdoptVisible={vi.fn()}
        isAdopting={false}
      />
      <AiGradingGrid
        cropRegion={cropRegion}
        currentUserId={CURRENT_USER_ID}
        pageSize="A4"
        display={display}
        visibleItems={grid.visibleItems}
        visibleIds={grid.visibleIds}
        selectedIds={grid.selectedIds}
        onSelect={grid.handleSelectAnswer}
        onReplaceSelection={(ids) => grid.setSelection(new Set(ids))}
        totalCount={grid.gridItems.length}
        draftAnnotationsByAttemptId={new Map()}
      />
    </>
  )
}

function cellOf(answerId: string): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-answer-id="${answerId}"]`
  )
  if (!cell) throw new Error(`答案 ${answerId} のマスが描かれていません`)
  return cell
}

function blanknessBadgeOf(answerId: string): HTMLElement | null {
  return within(cellOf(answerId)).queryByTestId("ai-blankness-badge")
}

describe("白紙を無答にする対象", () => {
  it("インク率で白紙、かつ自分が未採点の答案だけ（境界帯・採点済み・書き込みありは除く）", () => {
    expect(blankUnscoredExamStudentIds(reviewedAnswers)).toEqual([
      "blank",
      "blank-hidden",
    ])
  })
})

describe("一覧の「白紙」のバッジと「対象を選ぶ」", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("白紙の答案のマスにだけ「白紙」を出し、境界帯は「白紙?」で分ける", () => {
    installFakeElectronApi()
    renderWithProviders(<BlankTargetsHarness />)

    expect(screen.getByTestId("visible").textContent).toBe(
      "written,blank,borderline"
    )
    const blankBadge = blanknessBadgeOf("blank")
    expect(blankBadge).toHaveTextContent(/^白紙$/)
    expect(blankBadge).toHaveAttribute("data-blankness", "blank")
    const borderlineBadge = blanknessBadgeOf("borderline")
    expect(borderlineBadge).toHaveTextContent("白紙?")
    expect(borderlineBadge).toHaveAttribute("data-blankness", "borderline")
    expect(blanknessBadgeOf("written")).toBeNull()
    // 模範解答には出さない
    expect(blanknessBadgeOf(`master-${CROP_REGION_ID}`)).toBeNull()
  })

  it("件数は隠れた対象も数え、「対象を選ぶ」で隠れた対象も一覧に出して対象だけを選ぶ", async () => {
    installFakeElectronApi()
    renderWithProviders(<BlankTargetsHarness />)

    expect(
      screen.getByRole("button", { name: "白紙を無答に（2件）" })
    ).toBeTruthy()
    expect(
      screen.getByTestId("ai-hidden-blank-target-count")
    ).toHaveTextContent("1 件は今の絞り込みで隠れています")
    // 何も選んでいなければ先頭の答案を選んでいるものとする
    expect(screen.getByTestId("selection").textContent).toBe("written")

    await userEvent.click(screen.getByRole("button", { name: /対象を選ぶ/ }))

    expect(screen.getByTestId("visible").textContent).toBe(
      "written,blank,blank-hidden,borderline"
    )
    expect(screen.getByTestId("selection").textContent).toBe(
      "blank,blank-hidden"
    )
    expect(blanknessBadgeOf("blank-hidden")).toHaveTextContent(/^白紙$/)
    // 隠れていた対象が一覧に出たので、隠れている件数の知らせは消える
    expect(screen.queryByTestId("ai-hidden-blank-target-count")).toBeNull()
  })

  it("確認の文で印の付いた答案が対象だと示し、確かめた後に同じ対象を無答として書く", async () => {
    const aiGrading = installFakeElectronApi()
    renderWithProviders(<BlankTargetsHarness />)

    await userEvent.click(
      screen.getByRole("button", { name: "白紙を無答に（2件）" })
    )
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("「白紙」の印が付いた答案")
    expect(dialog).toHaveTextContent(
      "うち 1 件は今の絞り込みで一覧から隠れています"
    )
    expect(aiGrading.adoptBlankAnswers).not.toHaveBeenCalled()

    await userEvent.click(
      within(dialog).getByRole("button", { name: "無答にする" })
    )
    await waitFor(() =>
      expect(aiGrading.adoptBlankAnswers).toHaveBeenCalledWith({
        cropRegionId: CROP_REGION_ID,
        examStudentIds: ["blank", "blank-hidden"],
        overwrite: false,
      })
    )
  })
})
