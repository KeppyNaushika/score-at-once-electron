// @vitest-environment jsdom
/**
 * 生徒管理の一覧で、在籍予定（開始日がまだ来ていない所属）しか無い生徒が見えること。
 *
 * 在籍中の判定を開始日も見るように厳密にしたので、在籍予定の生徒は在籍中ではなくなった。
 * 新年度の学級を前もって組んだ生徒が既定の絞り込み（未在籍・在籍中）から消えると、登録した
 * はずの生徒が見つからない。既定の絞り込みと「在籍予定」で見え、「過去在籍」には入らず、
 * 所属学級の欄で在籍予定と分かることを固定する。
 */

import "../setup"

import type { Classroom, Student } from "@prisma/client"
import { render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DEFAULT_STUDENT_MEMBERSHIP_STATUSES,
  STUDENT_MEMBERSHIP_STATUSES,
  type StudentMembershipStatus,
  useStudentTableRows,
} from "@/components/student/hooks/useStudentTableRows"
import { StudentTableRow } from "@/components/student/StudentTableRow"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

/** 今日: 2026/3/20（新年度の学級を前もって組む時期） */
const TODAY = new Date(2026, 2, 20, 12, 0)
const CREATED_AT = new Date(2026, 0, 1)

function buildClassroom(id: string, name: string): Classroom {
  return {
    id,
    name,
    classroomCode: null,
    grade: 1,
    description: null,
    isVisible: true,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }
}

const CLASSROOM_THIS_YEAR = buildClassroom("classroom-this-year", "1年1組")
const CLASSROOM_NEXT_YEAR = buildClassroom("classroom-next-year", "2年1組")

function buildStudent(
  id: string,
  lastName: string,
  memberships: {
    classroom: Classroom
    startDate: Date
    endDate: Date | null
  }[]
): StudentWithMemberships {
  const student: Student = {
    id,
    studentNumber: `no-${id}`,
    lastName,
    firstName: "太郎",
    lastNameKana: "せい",
    firstNameKana: "たろう",
    enrollmentYear: 2025,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }
  return {
    ...student,
    memberships: memberships.map(({ classroom, startDate, endDate }) => ({
      id: `membership-${id}-${classroom.id}`,
      studentId: id,
      classroomId: classroom.id,
      startDate,
      endDate,
      attendanceNumber: 1,
      notes: null,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      classroom,
    })),
  }
}

/** 4/1 から 2年1組に入る予定だけを持つ（今は在籍していない） */
const STUDENT_UPCOMING = buildStudent("student-upcoming", "予定", [
  {
    classroom: CLASSROOM_NEXT_YEAR,
    startDate: new Date(2026, 3, 1, 9),
    endDate: null,
  },
])
/** 今は 1年1組に在籍中 */
const STUDENT_CURRENT = buildStudent("student-current", "在籍", [
  {
    classroom: CLASSROOM_THIS_YEAR,
    startDate: new Date(2025, 3, 1, 9),
    endDate: null,
  },
])
/** 去年度で終わった所属だけを持つ */
const STUDENT_PAST = buildStudent("student-past", "過年度", [
  {
    classroom: CLASSROOM_THIS_YEAR,
    startDate: new Date(2024, 3, 1, 9),
    endDate: new Date(2025, 2, 31, 9),
  },
])
/** 所属が1件も無い */
const STUDENT_UNASSIGNED = buildStudent("student-unassigned", "未所属", [])

const STUDENTS = [
  STUDENT_UPCOMING,
  STUDENT_CURRENT,
  STUDENT_PAST,
  STUDENT_UNASSIGNED,
]

/** 絞り込みを通った生徒の id（並びは問わない） */
function visibleStudentIds(
  membershipStatuses: ReadonlySet<StudentMembershipStatus>
): string[] {
  const { result } = renderHook(() =>
    useStudentTableRows({
      students: STUDENTS,
      classrooms: [],
      searchTerm: "",
      classroomId: "all",
      membershipStatuses,
    })
  )
  return result.current.sortedData.map((row) => row.id).toSorted()
}

describe("生徒管理の一覧: 在籍予定の生徒", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("既定の絞り込み（未在籍・在籍中・在籍予定）で見える。過去在籍だけの生徒は見えない", () => {
    expect(visibleStudentIds(DEFAULT_STUDENT_MEMBERSHIP_STATUSES)).toEqual(
      [
        STUDENT_UPCOMING.id,
        STUDENT_CURRENT.id,
        STUDENT_UNASSIGNED.id,
      ].toSorted()
    )
  })

  it("「在籍予定」で見え、「在籍中」と「過去在籍」には入らない", () => {
    expect(visibleStudentIds(new Set(["upcoming"]))).toEqual([
      STUDENT_UPCOMING.id,
    ])
    expect(visibleStudentIds(new Set(["current"]))).toEqual([
      STUDENT_CURRENT.id,
    ])
    expect(visibleStudentIds(new Set(["past"]))).toEqual([STUDENT_PAST.id])
  })

  it("複数の状態を選ぶと、どれかに当てはまる生徒が出る。全部選べば全員", () => {
    expect(visibleStudentIds(new Set(["past", "unassigned"]))).toEqual(
      [STUDENT_PAST.id, STUDENT_UNASSIGNED.id].toSorted()
    )
    expect(visibleStudentIds(new Set(STUDENT_MEMBERSHIP_STATUSES))).toEqual(
      STUDENTS.map((student) => student.id).toSorted()
    )
    expect(visibleStudentIds(new Set())).toEqual([])
  })

  it("所属学級の欄に「予定」と開始日が出る", () => {
    render(
      <table>
        <tbody>
          <StudentTableRow
            student={STUDENT_UPCOMING}
            isSelected={false}
            onOpen={vi.fn()}
            onToggleSelect={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </tbody>
      </table>
    )
    const badge = screen.getByTitle("在籍予定（2026/4/1から）")
    expect(badge).toHaveTextContent("2年1組")
    expect(badge).toHaveTextContent("予定")
  })
})
