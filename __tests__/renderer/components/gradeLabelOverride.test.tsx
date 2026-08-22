// @vitest-environment jsdom
/**
 * 評定（成績ラベル）の上書きの受け取り方の検査。
 *
 * 成績は評価の後にある ── まず評価があり、それを何点として解釈するかが後に来る。
 * だから上書きは自由でなければならない。自動算出できない「／」を校長判断で与える
 * ことがあり、それを弾くと教員が下した判断がどこにも残らない。
 *
 * 画面で確かめるのは、純粋関数だけでは固定できない3つ:
 *
 * 1. **基準に無い評定のマスは赤い。** ただし境界が1本以上あるときだけで、
 *    引く前の段階で全マスが赤くても直しようがない。
 * 2. **境界設定（05）に、入力されたが基準に無い評定を件数つきで並べる。**
 *    基準を決めるときに気づくべきであって、評価するときではない。
 * 3. **「／」がそのまま保存される。** 入力に制限はかかっていない。
 */

import "../setup"

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BoundariesContainer } from "@/components/grades/05-boundaries/BoundariesContainer"
import { ResultsContainer } from "@/components/grades/06-results/ResultsContainer"
import { ResultsTable } from "@/components/grades/06-results/ResultsTable"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { PublicUser } from "@/queries/user"
import type {
  GradeCalculationResult,
  GradeItemResult,
  StudentGradeResult,
} from "@/types/grade.types"

import { createQueryWrapper } from "../../helpers/queryWrapper"

// 境界の並べ替えは dnd-kit（jsdom では DndContext がそのまま落ちる）。ここで見たいのは
// 基準に無い評定の扱いなので、行を素通しさせてほどく。
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
const GRADE_ID = "grade-1"
const GRADE_ITEM_ID = "gradeItem-1"
const OTHER_GRADE_ITEM_ID = "gradeItem-2"

const currentUser: PublicUser = {
  id: "user-1",
  username: "testuser",
  name: "テストユーザー",
  role: "admin",
  passcodeType: null,
  createdAt: AT,
  updatedAt: AT,
}

const BOUNDARY_LABELS = [
  { label: "A", minPercentage: 80 },
  { label: "B", minPercentage: 60 },
  { label: "C", minPercentage: 0 },
]

/** 評価項目に引かれた境界（行の形は DB の GradeItemBoundary と同じ） */
function boundaryRows(gradeItemId: string, withBoundaries: boolean) {
  if (!withBoundaries) return []
  return BOUNDARY_LABELS.map((boundary, order) => ({
    id: `boundary-${gradeItemId}-${order}`,
    gradeItemId,
    label: boundary.label,
    minPercentage: boundary.minPercentage,
    order,
    createdAt: AT,
    updatedAt: AT,
  }))
}

/**
 * 上書きの有無を与える評価項目の結果。
 *
 * 自動算出値は境界から選ばれるので、境界が0本なら null になる（実際の
 * `determineGradeLabel` と同じ）。実効値は 上書き > 自動算出値。
 */
function gradeItemResult(
  gradeItemId: string,
  overrideGradeLabel: string | null,
  originalGradeLabel: string | null = "B"
): GradeItemResult {
  return {
    gradeItemId,
    gradeItemName: "評定",
    isExcluded: false,
    isAllMissing: false,
    sourceScores: [],
    weightedScore: 70,
    weightedMaxScore: 100,
    percentage: 70,
    gradeLabel: overrideGradeLabel ?? originalGradeLabel,
    originalGradeLabel,
    overrideGradeLabel,
    frozen: null,
  }
}

/** 生徒1人 */
function student(
  gradeStudentId: string,
  gradeItemResults: GradeItemResult[]
): StudentGradeResult {
  return {
    gradeStudentId,
    studentId: `student-${gradeStudentId}`,
    studentNumber: gradeStudentId,
    lastName: "山田",
    firstName: "太郎",
    attendanceNumber: 1,
    className: "3-A",
    gradeItemResults,
  }
}

/** 生徒1人。評価項目ごとの上書きを与える（自動算出値は B） */
function studentWithOverrides(
  gradeStudentId: string,
  overrideByGradeItemId: Record<string, string | null>
): StudentGradeResult {
  return student(
    gradeStudentId,
    Object.entries(overrideByGradeItemId).map(
      ([gradeItemId, overrideGradeLabel]) =>
        gradeItemResult(gradeItemId, overrideGradeLabel)
    )
  )
}

/** 評価項目1つ・生徒1人の算出結果 */
function calculationResult(
  overrideGradeLabel: string | null,
  withBoundaries: boolean
): GradeCalculationResult {
  return {
    gradeId: GRADE_ID,
    gradeName: "1学期",
    classNames: ["3-A"],
    gradeItems: [
      {
        id: GRADE_ITEM_ID,
        name: "評定",
        order: 0,
        dataSources: [],
        boundaries: boundaryRows(GRADE_ITEM_ID, withBoundaries).map(
          (boundary) => ({
            label: boundary.label,
            minPercentage: boundary.minPercentage,
            order: boundary.order,
          })
        ),
      },
    ],
    students: [
      student("gs-1", [
        gradeItemResult(
          GRADE_ITEM_ID,
          overrideGradeLabel,
          withBoundaries ? "B" : null
        ),
      ]),
    ],
  }
}

const noop = () => {}

/** 結果の表だけを載せる（上書きの保存先はテストが受け取る） */
function renderResultsTable(
  result: GradeCalculationResult,
  onGradeOverride: (params: { overrideLabel: string | null }) => void = noop
) {
  render(
    <ResultsTable
      result={result}
      onGradeOverride={onGradeOverride}
      onRefreezeCell={noop}
      onUnfreezeCell={noop}
    />
  )
}

const calculateGrades = vi.fn()
const getById = vi.fn()
const getGradeConstraints = vi.fn()
const upsertGradeOverride = vi.fn()
const deleteGradeOverride = vi.fn()

/** 算出結果と成績本体を与えて window.electronAPI を差し替える */
function mockGradeApi(
  result: GradeCalculationResult,
  gradeItems: { id: string; name: string; withBoundaries: boolean }[]
) {
  calculateGrades.mockResolvedValue(result)
  getGradeConstraints.mockResolvedValue([])
  upsertGradeOverride.mockResolvedValue(undefined)
  deleteGradeOverride.mockResolvedValue(undefined)
  getById.mockResolvedValue({
    id: GRADE_ID,
    name: "1学期",
    description: null,
    referenceDate: null,
    createdAt: AT,
    updatedAt: AT,
    gradeItems: gradeItems.map((gradeItem, order) => ({
      id: gradeItem.id,
      gradeId: GRADE_ID,
      name: gradeItem.name,
      order,
      dataSources: [],
      boundaries: boundaryRows(gradeItem.id, gradeItem.withBoundaries),
    })),
  })

  Object.defineProperty(window, "electronAPI", {
    value: {
      grade: {
        getById,
        calculateGrades,
        getGradeConstraints,
        upsertGradeOverride,
        deleteGradeOverride,
        freezeGradeScores: vi.fn().mockResolvedValue(undefined),
        unfreezeGradeScores: vi.fn().mockResolvedValue(undefined),
      },
    },
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  Reflect.deleteProperty(window, "electronAPI")
})

describe("結果(06): 基準に無い評定のマス", () => {
  it("境界が1本以上あるとき、基準に無い評定のマスは赤い", () => {
    renderResultsTable(calculationResult("／", true))

    const cell = screen.getByTitle(/手動: ／/)
    expect(cell).toHaveTextContent("／")
    expect(cell.className).toContain("bg-red-100")
  })

  it("境界が0本のときは赤くしない（引く前の段階では判定しない）", () => {
    renderResultsTable(calculationResult("／", false))

    const cell = screen.getByTitle(/手動: ／/)
    expect(cell).toHaveTextContent("／")
    expect(cell.className).not.toContain("bg-red-100")
  })

  it("基準にある評定への上書きは赤くない（上書きの印だけ）", () => {
    renderResultsTable(calculationResult("A", true))

    const cell = screen.getByTitle(/手動: A/)
    expect(cell.className).not.toContain("bg-red-100")
    expect(cell.className).toContain("bg-amber-100")
  })

  it("上書きが無ければ赤くない", () => {
    renderResultsTable(calculationResult(null, true))

    const cell = screen.getByText("B")
    expect(cell.className).not.toContain("bg-red-100")
  })
})

describe("結果(06): 上書きは制限しない", () => {
  it("「／」を入力すると、そのまま上書きとして渡る", async () => {
    const user = userEvent.setup()
    const onGradeOverride = vi.fn()
    renderResultsTable(calculationResult("A", true), onGradeOverride)

    await user.click(screen.getByTitle(/手動: A/))
    await user.type(screen.getByPlaceholderText("A"), "／{Enter}")

    expect(onGradeOverride).toHaveBeenCalledWith({
      gradeStudentId: "gs-1",
      gradeItemId: GRADE_ITEM_ID,
      overrideLabel: "／",
    })
  })

  it("「／」がそのまま保存される（IPC まで文字が変わらない）", async () => {
    const user = userEvent.setup()
    mockGradeApi(calculationResult("A", true), [
      { id: GRADE_ITEM_ID, name: "評定", withBoundaries: true },
    ])
    const QueryWrapper = createQueryWrapper()
    render(
      <QueryWrapper>
        <CurrentUserProvider user={currentUser}>
          <ResultsContainer gradeId={GRADE_ID} />
        </CurrentUserProvider>
      </QueryWrapper>
    )

    await user.click(await screen.findByTitle(/手動: A/))
    await user.type(screen.getByPlaceholderText("A"), "／{Enter}")

    await waitFor(() => {
      expect(upsertGradeOverride).toHaveBeenCalledWith({
        gradeStudentId: "gs-1",
        gradeItemId: GRADE_ITEM_ID,
        overrideLabel: "／",
      })
    })
  })
})

describe("境界設定(05): 基準に無い評定の列挙", () => {
  /** 評価項目2つ（1つ目には基準に無い評定があり、2つ目には無い）の算出結果 */
  function resultWithTwoGradeItems(): GradeCalculationResult {
    const base = calculationResult("／", true)
    const gradeItem = base.gradeItems[0]
    return {
      ...base,
      gradeItems: [
        gradeItem,
        { ...gradeItem, id: OTHER_GRADE_ITEM_ID, name: "観点", order: 1 },
      ],
      students: [
        studentWithOverrides("gs-1", {
          [GRADE_ITEM_ID]: "／",
          [OTHER_GRADE_ITEM_ID]: "A",
        }),
        studentWithOverrides("gs-2", {
          [GRADE_ITEM_ID]: "／",
          [OTHER_GRADE_ITEM_ID]: null,
        }),
        studentWithOverrides("gs-3", {
          [GRADE_ITEM_ID]: "認定",
          [OTHER_GRADE_ITEM_ID]: "B",
        }),
      ],
    }
  }

  function renderBoundaries() {
    const QueryWrapper = createQueryWrapper()
    render(
      <QueryWrapper>
        <BoundariesContainer gradeId={GRADE_ID} />
      </QueryWrapper>
    )
  }

  it("入力されたが基準に無い評定と、その人数を出す", async () => {
    mockGradeApi(resultWithTwoGradeItems(), [
      { id: GRADE_ITEM_ID, name: "評定", withBoundaries: true },
      { id: OTHER_GRADE_ITEM_ID, name: "観点", withBoundaries: true },
    ])
    renderBoundaries()

    const notice = await screen.findByText(/基準にない評定が入力されています/)
    expect(notice).toHaveTextContent("／、認定（3件）")
  })

  it("基準に無い評定が0件の評価項目には何も出さない", async () => {
    mockGradeApi(resultWithTwoGradeItems(), [
      { id: GRADE_ITEM_ID, name: "評定", withBoundaries: true },
      { id: OTHER_GRADE_ITEM_ID, name: "観点", withBoundaries: true },
    ])
    renderBoundaries()

    // 1つ目の注意が出たことで算出結果は読み込み済み。2つ目（すべて基準内）には出ない
    await screen.findByText(/基準にない評定が入力されています/)
    expect(
      screen.getAllByText(/基準にない評定が入力されています/)
    ).toHaveLength(1)
  })

  it("境界が0本の評価項目には出さない（引く前の段階では判定しない）", async () => {
    mockGradeApi(calculationResult("／", false), [
      { id: GRADE_ITEM_ID, name: "評定", withBoundaries: false },
    ])
    renderBoundaries()

    expect(
      await screen.findByText(
        "境界が設定されていません。プリセットを選択するか手動で追加してください。"
      )
    ).toBeInTheDocument()
    await waitFor(() => expect(calculateGrades).toHaveBeenCalled())
    expect(screen.queryByText(/基準にない評定が入力されています/)).toBeNull()
  })
})
