// @vitest-environment jsdom
/**
 * 07 の AI採点モード、採点反映のタブの「自分で採点」で採点したら、次の答案へ選択を移す。
 *
 * ここで固定すること（一覧表示の「採点したら次へ」と同じ規則）:
 * - 次は、選んでいた答案のうち**並びで最後のもの**の次（複数選んでいても1つにする）
 * - 末尾まで来ていれば選択はそのまま
 * - キー・ボタン・部分点の入力欄の確定（F/J）で進み、入力欄を Esc で閉じたら進まない
 * - 次の答案は**書き込む前の並び**で決める。採点した答案が絞り込みから外れて並びが
 *   詰まっても、決めた答案が選ばれたまま
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiOwnScoringSection } from "@/components/exams/07-score-at-once/AiGrading/AiOwnScoringSection"
import { useAiGridSelection } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGridSelection"
import { useAiGridViewSettings } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiGridViewSettings"
import { useAiOwnScoring } from "@/components/exams/07-score-at-once/AiGrading/hooks/useAiOwnScoring"
import type { AiGradingAnswer } from "@/components/exams/07-score-at-once/AiGrading/types"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { ShortcutProvider } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { findNextAnswerIdAfterScoring } from "@/components/exams/07-score-at-once/ScoringMain/utils/nextAnswerAfterScoring"
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
  scoringMethod: "points",
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

const EXAM_STUDENT_IDS = ["s1", "s2", "s3", "s4"]

function installFakeElectronApi() {
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: { getUserKeyboardShortcuts: vi.fn(async () => ({})) },
      setQuestionScore: vi.fn(async () => ({})),
      updateQuestionScore: vi.fn(async () => ({ status: "updated" })),
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

/**
 * 答案（既定の絞り込み＝自分が未採点で AI の判定がある、に残るよう AI の判定を持たせる）。
 * 自分で採点した答案には自分の採点行を持たせる（書き込みの後に届く一覧の代わり）
 */
function buildAnswers(scoredExamStudentIds: ReadonlySet<string>) {
  return EXAM_STUDENT_IDS.map((examStudentId) =>
    makeAnswer(examStudentId, {
      attempts: [
        makeAttemptWithRun({ examStudentId, id: `attempt-${examStudentId}` }),
      ],
      questionScore: scoredExamStudentIds.has(examStudentId)
        ? makeQuestionScore({ examStudentId, status: "correct" })
        : undefined,
    })
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

/** 作業場と同じつなぎ方（選択は useAiGridSelection、書き込みは useAiOwnScoring） */
function AiOwnScoringHarness({
  initialSelection,
}: {
  initialSelection: string[]
}) {
  useContextValue("gradingMode", "ai")
  useContextValue("hasSelectedAnswers", false)
  const [scoredExamStudentIds, setScoredExamStudentIds] = useState<
    ReadonlySet<string>
  >(new Set())
  const answers = buildAnswers(scoredExamStudentIds)
  const viewSettings = useAiGridViewSettings()
  const grid = useAiGridSelection({
    cropRegion,
    reviewedAnswers: answers.map(reviewed),
    layoutDirection: "right-down",
    itemsPerLine: [4],
    viewSettings,
  })
  const [isInitialized, setIsInitialized] = useState(false)
  if (!isInitialized) {
    setIsInitialized(true)
    grid.setSelection(new Set(initialSelection))
  }
  const { scoreSelected, partialScore } = useAiOwnScoring({
    examId: "exam-1",
    currentUserId: CURRENT_USER_ID,
    cropRegion,
    studentAnswerImages: answers.map((answer) => answer.studentAnswerImage),
    questionScores: [],
    selectedItems: grid.selectedItems,
    isShortcutEnabled: true,
    onScored: (examStudentIds) => {
      grid.markScored(examStudentIds)
      // 書き込みが一覧に届いた後の代わり（自分の採点が付き、既定の絞り込みから外れる）
      setScoredExamStudentIds((prev) => new Set([...prev, ...examStudentIds]))
    },
  })
  return (
    <>
      <output data-testid="visible">{grid.visibleIds.join(",")}</output>
      <output data-testid="selection">
        {grid.visibleIds
          .filter((examStudentId) => grid.selectedIds.has(examStudentId))
          .join(",")}
      </output>
      <AiOwnScoringSection
        cropRegion={cropRegion}
        selectedCount={grid.selectedItems.length}
        onScore={scoreSelected}
        partialScore={partialScore}
      />
    </>
  )
}

function shownSelection() {
  return screen.getByTestId("selection").textContent
}
function shownVisible() {
  return screen.getByTestId("visible").textContent
}

describe("採点した後に選ぶ答案（一覧表示と AI採点モードで共通の規則）", () => {
  it("選んでいた答案のうち並びで最後のものの次を返す", () => {
    expect(
      findNextAnswerIdAfterScoring(["s1", "s2", "s3", "s4"], new Set(["s1"]))
    ).toBe("s2")
    expect(
      findNextAnswerIdAfterScoring(
        ["s1", "s2", "s3", "s4"],
        new Set(["s3", "s1"])
      )
    ).toBe("s4")
  })

  it("模範解答は飛ばし、末尾なら null（選択はそのまま）", () => {
    expect(
      findNextAnswerIdAfterScoring(["s1", "master-1", "s2"], new Set(["s1"]))
    ).toBe("s2")
    expect(
      findNextAnswerIdAfterScoring(["s1", "s2"], new Set(["s2"]))
    ).toBeNull()
    expect(findNextAnswerIdAfterScoring(["s1", "s2"], new Set())).toBeNull()
  })

  it("書き込んだ後の（採点した答案が消えて詰まった）並びでは決められない", () => {
    // 書き込む前の並びなら s1 の次は s2
    expect(
      findNextAnswerIdAfterScoring(["s1", "s2", "s3"], new Set(["s1"]))
    ).toBe("s2")
    // s1 が絞り込みから外れた後の並びでは、どこが「次」か分からない
    expect(
      findNextAnswerIdAfterScoring(["s2", "s3"], new Set(["s1"]))
    ).toBeNull()
  })
})

describe("AI採点モードの「自分で採点」で採点したら次の答案へ", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installFakeElectronApi()
  })

  it("キーで採点すると次の答案を選び、採点した答案が絞り込みから外れても選んだまま", async () => {
    renderWithProviders(<AiOwnScoringHarness initialSelection={["s1"]} />)
    expect(shownSelection()).toBe("s1")

    await userEvent.keyboard("e")
    await waitFor(() => expect(shownSelection()).toBe("s2"))
    // 採点したばかりの答案は R までは残す
    expect(shownVisible()).toBe("s1,s2,s3,s4")

    // R で採点した答案を絞り込みから外す（並びが詰まる）。選択は s2 のまま
    await userEvent.keyboard("r")
    await waitFor(() => expect(shownVisible()).toBe("s2,s3,s4"))
    expect(shownSelection()).toBe("s2")

    // 詰まった並びでも続けて次へ進む
    await userEvent.keyboard("o")
    await waitFor(() => expect(shownSelection()).toBe("s3"))
  })

  it("採点した答案がすでに一覧から消えていても、続く採点の次は消える前の並びで決まる", async () => {
    renderWithProviders(<AiOwnScoringHarness initialSelection={["s2"]} />)
    await userEvent.keyboard("e")
    await waitFor(() => expect(shownSelection()).toBe("s3"))
    await userEvent.keyboard("r")
    await waitFor(() => expect(shownVisible()).toBe("s1,s3,s4"))
    expect(shownSelection()).toBe("s3")

    await userEvent.keyboard("e")
    await waitFor(() => expect(shownSelection()).toBe("s4"))
    await userEvent.keyboard("r")
    await waitFor(() => expect(shownVisible()).toBe("s1,s4"))
    expect(shownSelection()).toBe("s4")
  })

  it("複数選んでいたら、並びで最後の答案の次を1つだけ選ぶ", async () => {
    renderWithProviders(<AiOwnScoringHarness initialSelection={["s1", "s2"]} />)
    expect(shownSelection()).toBe("s1,s2")
    await userEvent.keyboard("e")
    await waitFor(() => expect(shownSelection()).toBe("s3"))
  })

  it("末尾の答案を採点したら選択はそのまま", async () => {
    renderWithProviders(<AiOwnScoringHarness initialSelection={["s4"]} />)
    await userEvent.keyboard("e")
    await waitFor(() =>
      expect(window.electronAPI.setQuestionScore).toHaveBeenCalled()
    )
    expect(shownSelection()).toBe("s4")
  })

  it("ボタンで採点してもキーと同じく次へ進む", async () => {
    renderWithProviders(<AiOwnScoringHarness initialSelection={["s1"]} />)
    await userEvent.click(screen.getByRole("button", { name: /正答/ }))
    await waitFor(() => expect(shownSelection()).toBe("s2"))
  })

  it("部分点の入力欄を F・J で確定すると次へ進み、Esc で閉じたら進まない", async () => {
    renderWithProviders(<AiOwnScoringHarness initialSelection={["s1"]} />)

    await userEvent.keyboard("2")
    await screen.findByRole("dialog")
    await userEvent.keyboard("f")
    await waitFor(() => expect(shownSelection()).toBe("s2"))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )

    await userEvent.keyboard("3")
    await screen.findByRole("dialog")
    await userEvent.keyboard("j")
    await waitFor(() => expect(shownSelection()).toBe("s3"))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )

    await userEvent.keyboard("1")
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("textbox")).toHaveValue("1")
    await userEvent.keyboard("{Escape}")
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    await act(async () => {})
    expect(shownSelection()).toBe("s3")
  })
})
