// @vitest-environment jsdom
/**
 * 試験外成績資料の点数入力（04）と評価項目（03）の、評語の受け取り方の検査。
 *
 * 画面で確かめるのは、純粋関数だけでは固定できない4つ:
 *
 * 1. **変換表に無い評語も保存する。** 以前は `pushPatch` を呼ばず黙って捨てていた。
 *    捨てると、教員が打った「認定」がどこにも残らない。
 * 2. **`A` と `a` は別の評語。** 以前は照合キーで大小文字を畳み、`a` を変換表の
 *    ラベル `A` として保存していた（打った文字が書き換わる）。
 * 3. **全角は黙って寄せない。** 貼り付け1回につき1度だけ尋ね、承諾されたときだけ
 *    半角へ寄せる。断られたら貼られたそのままを保存する。
 * 4. **変換表が0本なら赤くしない。** 変換表を作る前に全マスが赤くても直しようがない。
 *
 * そして評価項目（03）で「入力されたが変換表に無い評語」を列挙すること。
 * 基準を決めるときに気づくべきであって、評価するときではない。
 */

import "../setup"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CourseworkItemsContainer } from "@/components/coursework/03-items/CourseworkItemsContainer"
import { CourseworkScoresContainer } from "@/components/coursework/04-scores/CourseworkScoresContainer"

import { createQueryWrapper } from "../../helpers/queryWrapper"

// 並べ替えは dnd-kit（jsdom では DndContext がそのまま落ちる）。ここで見たいのは
// 評語の受け取り方と変換表に無い評語の列挙なので、行を素通しさせてほどく。
// 並べ替え自体は `dragDropUtils.test.ts` が純粋関数として見ている
vi.mock("@/components/common/sortable-table", () => ({
  SortableTableProvider: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DragHandle: () => <span aria-hidden="true" />,
  useSortableRow: () => ({
    setNodeRef: () => {},
    style: {},
    dragHandleProps: {},
    isDragging: false,
  }),
}))

// next/link はアプリのルーターに繋がっているので、画面だけを載せるためにほどく
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const AT = new Date("2026-08-01T00:00:00.000Z")
const COURSEWORK_ID = "coursework-1"
const ITEM_ID = "item-1"
const COURSEWORK_STUDENT_ID = "cs-1"
const CLASSROOM_ID = "classroom-1"

/** 文字評価の評価項目1つだけを持つ資料 */
function courseworkDetail(labels: string[]) {
  return {
    id: COURSEWORK_ID,
    name: "夏休みの課題",
    description: null,
    date: null,
    createdAt: AT,
    updatedAt: AT,
    classrooms: [],
    tags: [],
    students: [],
    items: [
      {
        id: ITEM_ID,
        courseworkId: COURSEWORK_ID,
        name: "提出物",
        order: 0,
        maxScore: 100,
        inputMode: "letter",
        createdAt: AT,
        updatedAt: AT,
        letterScales: labels.map((label, order) => ({
          id: `scale-${order}`,
          courseworkItemId: ITEM_ID,
          label,
          score: 100 - order * 20,
          order,
        })),
      },
    ],
  }
}

/** 名簿1人 */
function courseworkStudents() {
  return [
    {
      id: COURSEWORK_STUDENT_ID,
      courseworkId: COURSEWORK_ID,
      studentId: "student-1",
      customOrder: null,
      createdAt: AT,
      updatedAt: AT,
      student: {
        id: "student-1",
        studentNumber: "0001",
        lastName: "山田",
        firstName: "太郎",
        memberships: [
          {
            id: "membership-1",
            studentId: "student-1",
            classroomId: CLASSROOM_ID,
            attendanceNumber: 1,
            createdAt: AT,
            updatedAt: AT,
            classroom: {
              id: CLASSROOM_ID,
              name: "3-A",
              createdAt: AT,
              updatedAt: AT,
            },
          },
        ],
      },
    },
  ]
}

/** その資料に登録された学級 */
function courseworkClassrooms() {
  return [
    {
      id: "cc-1",
      courseworkId: COURSEWORK_ID,
      classroomId: CLASSROOM_ID,
      order: 0,
      createdAt: AT,
      updatedAt: AT,
      classroom: {
        id: CLASSROOM_ID,
        name: "3-A",
        createdAt: AT,
        updatedAt: AT,
      },
    },
  ]
}

/** 保存済みの点数1件（評語のみ） */
function storedLetterScore(courseworkStudentId: string, letterValue: string) {
  return {
    id: `score-${courseworkStudentId}-${letterValue}`,
    courseworkItemId: ITEM_ID,
    courseworkStudentId,
    score: null,
    letterValue,
    adjustment: null,
    adjustmentReason: null,
    comment: null,
    courseworkStudent: {
      id: courseworkStudentId,
      courseworkId: COURSEWORK_ID,
      studentId: `student-${courseworkStudentId}`,
      customOrder: null,
      createdAt: AT,
      updatedAt: AT,
      student: {
        id: `student-${courseworkStudentId}`,
        studentNumber: courseworkStudentId,
        lastName: "山田",
        firstName: "太郎",
      },
    },
  }
}

const batchUpsertScores = vi.fn()
const getScores = vi.fn()
const getById = vi.fn()

/** 変換表のラベルと保存済みの点数を与えて window.electronAPI を差し替える */
function mockCourseworkApi(
  labels: string[],
  storedScores: ReturnType<typeof storedLetterScore>[]
) {
  getById.mockResolvedValue(courseworkDetail(labels))
  getScores.mockResolvedValue(storedScores)
  batchUpsertScores.mockResolvedValue(undefined)

  Object.defineProperty(window, "electronAPI", {
    value: {
      coursework: {
        getById,
        getScores,
        batchUpsertScores,
        getStudents: vi.fn().mockResolvedValue(courseworkStudents()),
        getClassrooms: vi.fn().mockResolvedValue(courseworkClassrooms()),
      },
    },
    writable: true,
    configurable: true,
  })
}

/** 点数入力（04）を載せ、評語のマスが出るまで待つ */
async function renderScores(placeholder: string) {
  const QueryWrapper = createQueryWrapper()
  render(<CourseworkScoresContainer courseworkId={COURSEWORK_ID} />, {
    wrapper: QueryWrapper,
  })
  return await screen.findByPlaceholderText(placeholder)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  Reflect.deleteProperty(window, "electronAPI")
})

describe("点数入力(04): 評語の受け取り方", () => {
  it("変換表に無い評語も、入力された文字のまま保存する", async () => {
    const user = userEvent.setup()
    mockCourseworkApi(["A", "B"], [])

    const cell = await renderScores("A/B")
    await user.click(cell)
    await user.keyboard("認定")
    await user.tab()

    await waitFor(() => {
      expect(batchUpsertScores).toHaveBeenCalledWith([
        {
          courseworkItemId: ITEM_ID,
          courseworkStudentId: COURSEWORK_STUDENT_ID,
          letterValue: "認定",
        },
      ])
    })
  })

  it("A と a を区別する（変換表に A だけあるとき、a は A へ書き換えない）", async () => {
    const user = userEvent.setup()
    mockCourseworkApi(["A"], [])

    const cell = await renderScores("A")
    await user.click(cell)
    await user.keyboard("a")
    await user.tab()

    await waitFor(() => {
      expect(batchUpsertScores).toHaveBeenCalledWith([
        {
          courseworkItemId: ITEM_ID,
          courseworkStudentId: COURSEWORK_STUDENT_ID,
          letterValue: "a",
        },
      ])
    })
  })

  it("全角を貼り付けたら確認し、承諾すれば半角の A として保存する", async () => {
    const user = userEvent.setup()
    mockCourseworkApi(["A", "B"], [])

    const cell = await renderScores("A/B")
    await user.click(cell)
    await user.paste("Ａ")

    expect(
      await screen.findByText("全角文字が検知されました")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "半角にする" }))

    await waitFor(() => {
      expect(batchUpsertScores).toHaveBeenLastCalledWith([
        {
          courseworkItemId: ITEM_ID,
          courseworkStudentId: COURSEWORK_STUDENT_ID,
          letterValue: "A",
        },
      ])
    })
  })

  it("全角の確認を断れば、貼られた Ａ のまま保存する", async () => {
    const user = userEvent.setup()
    mockCourseworkApi(["A", "B"], [])

    const cell = await renderScores("A/B")
    await user.click(cell)
    await user.paste("Ａ")

    expect(
      await screen.findByText("全角文字が検知されました")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "そのまま貼り付ける" }))

    await waitFor(() => {
      expect(batchUpsertScores).toHaveBeenLastCalledWith([
        {
          courseworkItemId: ITEM_ID,
          courseworkStudentId: COURSEWORK_STUDENT_ID,
          letterValue: "Ａ",
        },
      ])
    })
  })

  it("全角が無ければ確認しない（貼り付けのたびに尋ねない）", async () => {
    const user = userEvent.setup()
    mockCourseworkApi(["A", "B"], [])

    const cell = await renderScores("A/B")
    await user.click(cell)
    await user.paste("B")

    await waitFor(() => {
      expect(batchUpsertScores).toHaveBeenCalledWith([
        {
          courseworkItemId: ITEM_ID,
          courseworkStudentId: COURSEWORK_STUDENT_ID,
          letterValue: "B",
        },
      ])
    })
    expect(screen.queryByText("全角文字が検知されました")).toBeNull()
  })

  it("変換表が1つ以上あるとき、変換表に無い評語のマスは赤い", async () => {
    mockCourseworkApi(
      ["A", "B"],
      [storedLetterScore(COURSEWORK_STUDENT_ID, "認定")]
    )

    const cell = await renderScores("A/B")

    await waitFor(() => expect(cell).toHaveValue("認定"))
    expect(cell.className).toContain("bg-red-100")
  })

  it("変換表が0本のときは赤くしない（作る前の段階では判定しない）", async () => {
    mockCourseworkApi([], [storedLetterScore(COURSEWORK_STUDENT_ID, "認定")])

    const cell = await renderScores("評価記号")

    await waitFor(() => expect(cell).toHaveValue("認定"))
    expect(cell.className).not.toContain("bg-red-100")
  })
})

describe("評価項目(03): 変換表に無い評語の列挙", () => {
  it("入力されたが変換表に無い評語と、その件数を出す", async () => {
    mockCourseworkApi(
      ["A", "B"],
      [
        storedLetterScore("cs-1", "A"),
        storedLetterScore("cs-2", "認定"),
        storedLetterScore("cs-3", "認定"),
        storedLetterScore("cs-4", "b"),
      ]
    )
    const QueryWrapper = createQueryWrapper()
    render(<CourseworkItemsContainer courseworkId={COURSEWORK_ID} />, {
      wrapper: QueryWrapper,
    })

    const notice = await screen.findByText(/変換表にない評価が入力されています/)
    expect(notice).toHaveTextContent("認定、b（3件）")
  })

  it("変換表に無い評語が0件なら何も出さない", async () => {
    mockCourseworkApi(
      ["A", "B"],
      [storedLetterScore("cs-1", "A"), storedLetterScore("cs-2", "B")]
    )
    const QueryWrapper = createQueryWrapper()
    render(<CourseworkItemsContainer courseworkId={COURSEWORK_ID} />, {
      wrapper: QueryWrapper,
    })

    // 変換表の編集欄が出るまで待ってから、注意が無いことを見る
    expect(
      await screen.findByText("評価記号 → 点数の変換表")
    ).toBeInTheDocument()
    expect(screen.queryByText(/変換表にない評価が入力されています/)).toBeNull()
  })
})
