// @vitest-environment jsdom
/**
 * 07 の AI採点モード、採点反映のタブの「自分で採点」で部分点を入れる。
 *
 * ここで固定すること:
 * - 一覧表示と同じキー（数字・小数点）で一覧表示と同じ部分点の入力欄が開き、
 *   部分点のキー（F）・保留のキー（J）で、選んだ答案すべてに入れた点を書く
 * - 一覧表示の画面の入力欄のキーもいつも載っているが、AI採点モードではこちらが効く
 * - 採点反映のタブを開いていなければ数字キーでは開かない（ボタンでは開ける）
 * - Esc で閉じれば何も書かない
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiOwnScoringSection } from "@/components/exams/07-score-at-once/AiGrading/AiOwnScoringSection"
import { useAiOwnScoring } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiOwnScoring"
import type { AiGradingAnswer } from "@/components/exams/07-score-at-once/AiGrading/types"
import { toAiGridItem } from "@/components/exams/07-score-at-once/AiGrading/utils/aiGridItems"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { usePartialScoreShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/shortcuts/usePartialScoreShortcuts"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makeQuestionScore,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
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

/** 一覧表示の画面が載せている入力欄のキーの代わり（AI採点モードでは呼ばれてはいけない） */
const listViewPartialScoreHandlers = {
  handlePartialScoreInput: vi.fn(),
  handlePartialScoreConfirmPartial: vi.fn(),
  handlePartialScoreConfirmPending: vi.fn(),
  handlePartialScoreCancel: vi.fn(),
  handlePartialScoreBackspace: vi.fn(),
}

function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: { getUserKeyboardShortcuts: vi.fn(async () => ({})) },
      setQuestionScore: fakeScoringApi.setQuestionScore,
      updateQuestionScore: fakeScoringApi.updateQuestionScore,
    },
    writable: true,
    configurable: true,
  })
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

/**
 * 採点画面と同じく、一覧表示の入力欄のキー（一覧表示では答案を選んでいないので
 * `hasSelectedAnswers` は偽）を載せたうえで、採点反映のタブの「自分で採点」を描く
 */
function OwnPartialScoreHarness({
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
  useContextValue("hasSelectedAnswers", false)
  usePartialScoreShortcuts(listViewPartialScoreHandlers)
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

const answers = () => [
  makeAnswer("s1"),
  makeAnswer("s2", {
    questionScore: makeQuestionScore({
      examStudentId: "s2",
      status: "incorrect",
    }),
  }),
]

function expectListViewHandlersUntouched() {
  Object.values(listViewPartialScoreHandlers).forEach((handler) =>
    expect(handler).not.toHaveBeenCalled()
  )
}

describe("採点反映のタブの「自分で採点」での部分点（一覧表示と同じ入力欄）", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeElectronApi()
  })

  it("数字キーで入力欄を開き、F で選んだ答案すべてに入れた部分点を書く", async () => {
    const onScored = vi.fn()
    renderWithProviders(
      <OwnPartialScoreHarness
        answers={answers()}
        selectedExamStudentIds={["s1", "s2"]}
        isShortcutEnabled
        onScored={onScored}
      />
    )
    await userEvent.keyboard("2")
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(/4点満点/)).toBeInTheDocument()
    await userEvent.keyboard(".5")
    expect(within(dialog).getByRole("textbox")).toHaveValue("2.5")
    await userEvent.keyboard("f")

    await waitFor(() =>
      expect(fakeScoringApi.setQuestionScore).toHaveBeenCalledWith({
        examStudentId: "s1",
        cropRegionId: CROP_REGION_ID,
        partialScore: 2.5,
        status: "partial",
        userId: CURRENT_USER_ID,
      })
    )
    // 採点済みの答案は自分の行を書き換える
    await waitFor(() =>
      expect(fakeScoringApi.updateQuestionScore).toHaveBeenCalledWith(
        "score-s2",
        { partialScore: 2.5, status: "partial" }
      )
    )
    expect(onScored).toHaveBeenCalledWith(["s1", "s2"])
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expectListViewHandlersUntouched()
  })

  it("J で確定すると、入れた点を持った保留として書く", async () => {
    renderWithProviders(
      <OwnPartialScoreHarness
        answers={answers()}
        selectedExamStudentIds={["s1"]}
        isShortcutEnabled
        onScored={vi.fn()}
      />
    )
    await userEvent.keyboard("3")
    await screen.findByRole("dialog")
    await userEvent.keyboard("j")
    await waitFor(() =>
      expect(fakeScoringApi.setQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({
          examStudentId: "s1",
          partialScore: 3,
          status: "pending",
        })
      )
    )
    expectListViewHandlersUntouched()
  })

  it("Esc で閉じれば何も書かない", async () => {
    const onScored = vi.fn()
    renderWithProviders(
      <OwnPartialScoreHarness
        answers={answers()}
        selectedExamStudentIds={["s1"]}
        isShortcutEnabled
        onScored={onScored}
      />
    )
    await userEvent.keyboard("1")
    await screen.findByRole("dialog")
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(fakeScoringApi.setQuestionScore).not.toHaveBeenCalled()
    expect(onScored).not.toHaveBeenCalled()
    expectListViewHandlersUntouched()
  })

  it("採点反映のタブを開いていなければ数字キーでは開かず、キーを添えたボタンでは開ける", async () => {
    renderWithProviders(
      <OwnPartialScoreHarness
        answers={answers()}
        selectedExamStudentIds={["s1"]}
        isShortcutEnabled={false}
        onScored={vi.fn()}
      />
    )
    await userEvent.keyboard("2")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    const openButton = screen.getByRole("button", { name: /部分点入力/ })
    expect(within(openButton).getByText("0〜9")).toBeInTheDocument()
    await userEvent.click(openButton)
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "4" }))
    await userEvent.click(
      within(dialog).getByRole("button", { name: /部分点で確定/ })
    )
    await waitFor(() =>
      expect(fakeScoringApi.setQuestionScore).toHaveBeenCalledWith(
        expect.objectContaining({
          examStudentId: "s1",
          partialScore: 4,
          status: "partial",
        })
      )
    )
  })

  it("答案を選んでいなければボタンは押せず、数字キーでも開かない", async () => {
    renderWithProviders(
      <OwnPartialScoreHarness
        answers={answers()}
        selectedExamStudentIds={[]}
        isShortcutEnabled
        onScored={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: /部分点入力/ })).toBeDisabled()
    await userEvent.keyboard("2")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
