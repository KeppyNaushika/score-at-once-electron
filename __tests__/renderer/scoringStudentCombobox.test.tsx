// @vitest-environment jsdom
/**
 * 個別採点の受験者の切り替え（Combobox）と、採点キーの関係の検査。
 *
 * - Combobox の絞り込み欄で打った文字は採点にならない（`ShortcutProvider` は
 *   フォーカスが input にあると採点キーを止める。cmdk の欄も input であることを固定する）
 * - 選んで閉じるとフォーカスはボタンへ戻り、採点キーはまた効く
 * - 受験者は読み（カナ）でも探せる（ひらがなで打ってもカタカナの読みに当たる）
 */

import "./setup"

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { useCommand } from "@/components/exams/07-score-at-once/hooks/useCommand"
import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { StudentAnswerPanel } from "@/components/exams/07-score-at-once/ScoringIndividual/StudentAnswerPanel"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import type { ScoringExamStudent } from "@/components/exams/07-score-at-once/types"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { PublicUser } from "@/queries/user"

import { createQueryWrapper } from "../helpers/queryWrapper"

const currentUser: PublicUser = {
  id: "user-1",
  username: "testuser",
  name: "テストユーザー",
  role: "admin",
  passcodeType: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

const AT = new Date("2026-01-01T00:00:00.000Z")

function examStudent(
  id: string,
  customOrder: number,
  student: Pick<
    ScoringExamStudent["student"],
    | "studentNumber"
    | "lastName"
    | "firstName"
    | "lastNameKana"
    | "firstNameKana"
  >
): ScoringExamStudent {
  return {
    id,
    examId: "exam-1",
    studentId: `student-${id}`,
    status: "present",
    customOrder,
    createdAt: AT,
    updatedAt: AT,
    student: {
      id: `student-${id}`,
      enrollmentYear: null,
      createdAt: AT,
      updatedAt: AT,
      ...student,
    },
  }
}

const examStudents = [
  examStudent("exam-student-1", 1, {
    studentNumber: "1001",
    lastName: "山田",
    firstName: "太郎",
    lastNameKana: "ヤマダ",
    firstNameKana: "タロウ",
  }),
  examStudent("exam-student-2", 2, {
    studentNumber: "1002",
    lastName: "佐藤",
    firstName: "花子",
    lastNameKana: "サトウ",
    firstNameKana: "ハナコ",
  }),
]

/** 採点キー（正解）が発火したことの記録 */
const scoreCorrect = vi.fn()
/** 採点キー（部分点。入力欄の中でも評価へ進む側のキー）が発火したことの記録 */
const scorePartial = vi.fn()
/** 受験者を切り替えた記録 */
const changeStudent = vi.fn()

function ScoringKeysWithStudentPanel() {
  useContextValue("hasSelectedAnswers", true)
  const { keyBindings } = useShortcutContext()

  useCommand("scoring.correct", scoreCorrect, {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
  })
  useCommand("scoring.partial", scorePartial, {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers",
  })

  return (
    <>
      <span data-testid="partial-key">{keyBindings["scoring.partial"]}</span>
      <StudentAnswerPanel
        examStudents={examStudents}
        currentExamStudentId="exam-student-1"
        onStudentChange={changeStudent}
      />
    </>
  )
}

async function renderPanel() {
  const QueryWrapper = createQueryWrapper()
  render(
    <QueryWrapper>
      <CurrentUserProvider user={currentUser}>
        <ShortcutProvider>
          <ScoringKeysWithStudentPanel />
        </ShortcutProvider>
      </CurrentUserProvider>
    </QueryWrapper>
  )
  await act(async () => {
    await Promise.resolve()
  })
  await waitFor(() => {
    expect(screen.getByTestId("partial-key").textContent).toBe("f")
  })
}

beforeAll(() => {
  // cmdk は選択中の項目を scrollIntoView する。jsdom は持たない
  Element.prototype.scrollIntoView = () => {}
})

beforeEach(() => {
  scoreCorrect.mockReset()
  scorePartial.mockReset()
  changeStudent.mockReset()
  Object.defineProperty(window, "electronAPI", {
    value: {
      settings: {
        getUserKeyboardShortcuts: vi.fn().mockResolvedValue({}),
        setUserKeyboardShortcut: vi.fn().mockResolvedValue(undefined),
        resetUserKeyboardShortcuts: vi.fn().mockResolvedValue(undefined),
      },
    },
    writable: true,
    configurable: true,
  })
})

describe("個別採点の受験者の切り替え", () => {
  it("絞り込み欄で打った文字は採点にならず、選んで閉じると採点キーが戻る", async () => {
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole("combobox"))
    const searchInput = screen.getByPlaceholderText("氏名・番号・カナで検索")
    expect(searchInput).toHaveFocus()

    // e（正解）も f（部分点。入力欄の中でも評価へ進むキー）も、文字として入るだけ
    await user.keyboard("ef")
    expect(searchInput).toHaveValue("ef")
    expect(scoreCorrect).not.toHaveBeenCalled()
    expect(scorePartial).not.toHaveBeenCalled()

    await user.clear(searchInput)
    await user.keyboard("佐藤{Enter}")
    expect(changeStudent).toHaveBeenCalledWith("exam-student-2")

    // 閉じたらボタンへ戻り、採点キーはまた効く
    expect(screen.getByRole("combobox")).toHaveFocus()
    await user.keyboard("e")
    expect(scoreCorrect).toHaveBeenCalledTimes(1)
  })

  it("Esc で閉じても採点キーが戻る", async () => {
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole("combobox"))
    await user.keyboard("{Escape}")
    expect(screen.getByRole("combobox")).toHaveFocus()

    await user.keyboard("e")
    expect(scoreCorrect).toHaveBeenCalledTimes(1)
    expect(changeStudent).not.toHaveBeenCalled()
  })
  it("読み（カナ）でも探せる", async () => {
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole("combobox"))
    await user.keyboard("はなこ{Enter}")
    expect(changeStudent).toHaveBeenCalledWith("exam-student-2")
  })
})
