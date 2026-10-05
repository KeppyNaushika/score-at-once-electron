// @vitest-environment jsdom
/**
 * 採点担当の2軸化（docs/scoring-scope-and-permissions-design.md §3-1・§3-2）の検査。
 *
 * 1. **絞り込みは役割でなく自分の割り当てで決まる。** OWNER（割り当てを直せる人）でも
 *    設問は絞られ、「すべて表示」でだけ全部が出る（#840 の訂正）
 * 2. **生徒の担当0人は全員担当。** 自分の担当か、誰の担当でもない生徒が出る
 * 3. **05 の対応表は (examStudentId, userId) の組で書く。** 並びと id の順序をわざと
 *    食い違わせて固定する。「学級から」はその学級の生徒だけをまとめて書く
 */

import "@testing-library/jest-dom/vitest"

import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { StudentGraderAssignmentTable } from "@/components/exams/05-students/components/StudentGraderAssignmentTable"
import { useAssignedCropRegions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAssignedCropRegions"
import { useAssignedExamStudents } from "@/components/exams/shared/useAssignedExamStudents"
import { CurrentUserProvider } from "@/contexts/CurrentUserContext"
import type { ExamClassroomPlacement } from "@/lib/examClassroomPlacement"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { ExamStudentAssignmentRow } from "@/queries/scoring"
import type { ExamMemberRow } from "@/queries/userExam"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

import { createQueryWrapper } from "../../helpers/queryWrapper"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

// Radix が要るが jsdom は持たない
global.ResizeObserver = class implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

afterEach(() => {
  cleanup()
})

const EXAM_ID = "exam-1"
const TIMESTAMP = new Date("2026-10-01T00:00:00.000Z")

function user(id: string, name: string): ExamMemberRow["user"] {
  return {
    id,
    username: name,
    name,
    role: "teacher",
    passcodeType: "none",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
}

const OWNER = user("user-owner", "所有者")
const GRADER_A = user("user-a", "佐藤")
const GRADER_B = user("user-b", "鈴木")

function classroom(id: string, name: string) {
  return {
    id,
    name,
    classroomCode: null,
    grade: 1,
    description: null,
    isVisible: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
}

const CLASSROOM_1 = classroom("classroom-1", "1組")
const CLASSROOM_2 = classroom("classroom-2", "2組")

function examStudent(
  id: string,
  studentId: string,
  lastName: string
): ExamStudentWithMemberships {
  return {
    id,
    examId: EXAM_ID,
    studentId,
    status: "participating",
    customOrder: null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    student: {
      id: studentId,
      studentNumber: studentId,
      lastName,
      firstName: "太郎",
      lastNameKana: "",
      firstNameKana: "",
      enrollmentYear: null,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      memberships: [],
    },
    studentAnswerImages: [],
  }
}

/** **表示の並びと id の綴りをわざと食い違わせる** */
const EXAM_STUDENTS = [
  examStudent("exam-student-c", "student-c", "青木"),
  examStudent("exam-student-a", "student-a", "井上"),
  examStudent("exam-student-b", "student-b", "上田"),
]

/** 青木・井上が1組、上田が2組 */
const PLACEMENT_BY_STUDENT: Record<string, ExamClassroomPlacement> = {
  "student-c": { classroom: CLASSROOM_1, attendanceNumber: 1, order: 0 },
  "student-a": { classroom: CLASSROOM_1, attendanceNumber: 2, order: 0 },
  "student-b": { classroom: CLASSROOM_2, attendanceNumber: 1, order: 1 },
}

function assignment(
  examStudentId: string,
  assignee: ExamMemberRow["user"]
): ExamStudentAssignmentRow {
  return {
    id: `assignment-${examStudentId}-${assignee.id}`,
    examStudentId,
    userId: assignee.id,
    assignedBy: OWNER.id,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    user: assignee,
  }
}

function questionRegion(id: string): QuestionAnswerRegionRow {
  return {
    id,
    examPageId: "exam-page-1",
    label: id,
    type: "QUESTION_ANSWER",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    height: 0.2,
    points: 4,
    orderIndex: 0,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    examPage: {
      id: "exam-page-1",
      examId: EXAM_ID,
      pageNumber: 1,
      imagePath: "master/page1.png",
      pageSize: "A4",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    cropSubtotals: [],
  }
}

const getExamStudentAssignments = vi.fn(
  async (): Promise<ExamStudentAssignmentRow[]> => []
)
const setExamStudentAssignments = vi.fn(async () => 0)
const getCropRegionAssignments = vi.fn(async () => ({
  assignments: [] as {
    cropRegionId: string
    userId: string
    userName: string
  }[],
  canManage: true,
  memberCount: 2,
}))

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    writable: true,
    value: {
      getExamStudentAssignments,
      setExamStudentAssignments,
      getCropRegionAssignments,
    },
  })
})

describe("生徒の絞り込み（useAssignedExamStudents）", () => {
  it("自分の担当と、誰の担当でもない生徒を出し、他の人の担当は出さない", async () => {
    getExamStudentAssignments.mockResolvedValue([
      assignment("exam-student-a", GRADER_A),
      assignment("exam-student-b", GRADER_B),
    ])
    const { result } = renderHook(
      () =>
        useAssignedExamStudents({
          examId: EXAM_ID,
          userId: GRADER_A.id,
          showAll: false,
        }),
      { wrapper: createQueryWrapper() }
    )
    await waitFor(() => expect(result.current.hasStudentAssignments).toBe(true))

    expect(result.current.isVisibleExamStudent("exam-student-a")).toBe(true)
    expect(result.current.isVisibleExamStudent("exam-student-b")).toBe(false)
    // 担当0人は全員担当（学級に属さない生徒・割り当て忘れが消えない）
    expect(result.current.isVisibleExamStudent("exam-student-c")).toBe(true)
  })

  it("「すべて表示」なら他の人の担当も出る", async () => {
    getExamStudentAssignments.mockResolvedValue([
      assignment("exam-student-b", GRADER_B),
    ])
    const { result } = renderHook(
      () =>
        useAssignedExamStudents({
          examId: EXAM_ID,
          userId: GRADER_A.id,
          showAll: true,
        }),
      { wrapper: createQueryWrapper() }
    )
    await waitFor(() => expect(result.current.hasStudentAssignments).toBe(true))

    expect(result.current.isVisibleExamStudent("exam-student-b")).toBe(true)
    // 担当かどうかは「すべて表示」に関わらず答える（範囲の人数を数えるため）
    expect(result.current.isAssignedToMe("exam-student-b")).toBe(false)
  })
})

describe("設問の絞り込み（useAssignedCropRegions）", () => {
  const CROP_REGIONS = [questionRegion("region-1"), questionRegion("region-2")]

  it("割り当てを直せる人（OWNER）でも、自分の担当で絞る", async () => {
    getCropRegionAssignments.mockResolvedValue({
      assignments: [
        { cropRegionId: "region-1", userId: OWNER.id, userName: "所有者" },
        { cropRegionId: "region-2", userId: GRADER_A.id, userName: "佐藤" },
      ],
      canManage: true,
      memberCount: 2,
    })
    const { result } = renderHook(
      () =>
        useAssignedCropRegions({
          examId: EXAM_ID,
          userId: OWNER.id,
          cropRegions: CROP_REGIONS,
          showAll: false,
        }),
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => expect(result.current.isFiltered).toBe(true))
    expect(
      result.current.selectableCropRegions.map((cropRegion) => cropRegion.id)
    ).toEqual(["region-1"])
    expect(result.current.assignedCropRegionCount).toBe(1)
  })

  it("「すべて表示」なら全設問が出る", async () => {
    getCropRegionAssignments.mockResolvedValue({
      assignments: [
        { cropRegionId: "region-2", userId: GRADER_A.id, userName: "佐藤" },
      ],
      canManage: true,
      memberCount: 2,
    })
    const { result } = renderHook(
      () =>
        useAssignedCropRegions({
          examId: EXAM_ID,
          userId: OWNER.id,
          cropRegions: CROP_REGIONS,
          showAll: true,
        }),
      { wrapper: createQueryWrapper() }
    )

    // 担当の範囲は数え続ける（region-1 は担当0人なので全員担当）
    await waitFor(() => expect(result.current.assignedCropRegionCount).toBe(1))
    expect(result.current.selectableCropRegions).toHaveLength(2)
    expect(result.current.isFiltered).toBe(false)
  })
})

/** 対応表を所有者として描く */
function renderTable({
  assignedUserIdsByExamStudentId = new Map<string, Set<string>>(),
  canManage = true,
}: {
  assignedUserIdsByExamStudentId?: ReadonlyMap<string, ReadonlySet<string>>
  canManage?: boolean
} = {}) {
  return render(
    <CurrentUserProvider user={OWNER}>
      <StudentGraderAssignmentTable
        examId={EXAM_ID}
        examStudents={EXAM_STUDENTS}
        placementByStudent={PLACEMENT_BY_STUDENT}
        graders={[GRADER_B, GRADER_A]}
        assignedUserIdsByExamStudentId={assignedUserIdsByExamStudentId}
        canManage={canManage}
      />
    </CurrentUserProvider>,
    { wrapper: createQueryWrapper() }
  )
}

/** その生徒の行の、その採点者の列にあるマス（列は 鈴木・佐藤 の順） */
function cellOf(lastName: string, graderName: "鈴木" | "佐藤"): HTMLElement {
  const row = screen.getByText(`${lastName} 太郎`).closest("tr")
  if (!row) throw new Error(`生徒の行が無い: ${lastName}`)
  const columnIndex = graderName === "鈴木" ? 0 : 1
  // 先頭は生徒名の固定列なので、採点者の列はその次から並ぶ
  const cells = row.querySelectorAll("td")
  const checkbox = cells[columnIndex + 1]?.querySelector('[role="checkbox"]')
  if (!(checkbox instanceof HTMLElement)) {
    throw new Error(`マスが無い: ${lastName} × ${graderName}`)
  }
  return checkbox
}

describe("生徒 × 採点者の対応表（05）", () => {
  it("マスを入れると、その生徒とその採点者の組で書く", async () => {
    const userAction = userEvent.setup()
    renderTable()

    // 表示は2行目・2列目だが、書き込み先は綴りの一致で決まる
    await userAction.click(cellOf("井上", "佐藤"))

    expect(setExamStudentAssignments).toHaveBeenCalledTimes(1)
    expect(setExamStudentAssignments).toHaveBeenCalledWith({
      examId: EXAM_ID,
      userId: GRADER_A.id,
      examStudentIds: ["exam-student-a"],
      assigned: true,
      requestedByUserId: OWNER.id,
    })
  })

  it("入っているマスを外すと、その組で外す", async () => {
    const userAction = userEvent.setup()
    renderTable({
      assignedUserIdsByExamStudentId: new Map([
        ["exam-student-b", new Set([GRADER_B.id])],
      ]),
    })

    expect(cellOf("上田", "鈴木")).toBeChecked()
    await userAction.click(cellOf("上田", "鈴木"))

    expect(setExamStudentAssignments).toHaveBeenCalledWith({
      examId: EXAM_ID,
      userId: GRADER_B.id,
      examStudentIds: ["exam-student-b"],
      assigned: false,
      requestedByUserId: OWNER.id,
    })
  })

  it("「学級から」はその学級の生徒だけを、まだ担当でない分だけまとめて書く", async () => {
    const userAction = userEvent.setup()
    renderTable({
      // 青木は既に佐藤の担当
      assignedUserIdsByExamStudentId: new Map([
        ["exam-student-c", new Set([GRADER_A.id])],
      ]),
    })

    // 列は 鈴木・佐藤 の順。佐藤の「学級から」を開く
    const [, satoMenuButton] = screen.getAllByRole("button", {
      name: "学級から",
    })
    await userAction.click(satoMenuButton)
    await userAction.click(await screen.findByRole("menuitem", { name: /1組/ }))

    expect(setExamStudentAssignments).toHaveBeenCalledTimes(1)
    expect(setExamStudentAssignments).toHaveBeenCalledWith({
      examId: EXAM_ID,
      userId: GRADER_A.id,
      examStudentIds: ["exam-student-a"],
      assigned: true,
      requestedByUserId: OWNER.id,
    })
  })

  it("所有者でなければ読めるだけで、直せない", async () => {
    const userAction = userEvent.setup()
    renderTable({
      assignedUserIdsByExamStudentId: new Map([
        ["exam-student-a", new Set([GRADER_A.id])],
      ]),
      canManage: false,
    })

    expect(cellOf("井上", "佐藤")).toBeChecked()
    expect(cellOf("青木", "佐藤")).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "学級から" })
    ).not.toBeInTheDocument()

    await userAction.click(cellOf("青木", "佐藤"))
    expect(setExamStudentAssignments).not.toHaveBeenCalled()
  })
})
