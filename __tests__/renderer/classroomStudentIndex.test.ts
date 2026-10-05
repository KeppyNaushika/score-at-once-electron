/**
 * 書き出しダイアログの「学級から選ぶ生徒」: 選んだ所属の時期（在籍中・在籍予定・過去在籍）の
 * どれかに当たる所属を学級に持つ生徒が入る。何も選ばなければ入らない。
 */

import type { Classroom } from "@prisma/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildClassroomStudentIndex } from "@/components/unified-archive/export/classroomStudents"
import type { MembershipPhase } from "@/lib/membership"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

const TODAY = new Date(2026, 2, 20, 12, 0)
const CREATED_AT = new Date(2026, 0, 1)

const CLASSROOM: Classroom = {
  id: "classroom-1",
  name: "2年1組",
  classroomCode: null,
  grade: 2,
  description: null,
  isVisible: true,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}

function buildStudent(
  id: string,
  startDate: Date,
  endDate: Date | null
): StudentWithMemberships {
  return {
    id,
    studentNumber: `no-${id}`,
    lastName: "生徒",
    firstName: id,
    lastNameKana: "せいと",
    firstNameKana: "たろう",
    enrollmentYear: 2025,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    memberships: [
      {
        id: `membership-${id}`,
        studentId: id,
        classroomId: CLASSROOM.id,
        startDate,
        endDate,
        attendanceNumber: 1,
        notes: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        classroom: CLASSROOM,
      },
    ],
  }
}

const STUDENTS = [
  buildStudent("upcoming", new Date(2026, 3, 1, 9), null),
  buildStudent("current", new Date(2025, 3, 1, 9), null),
  buildStudent("past", new Date(2024, 3, 1, 9), new Date(2025, 2, 31, 9)),
]

describe("buildClassroomStudentIndex", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    { phases: ["current"], expected: ["current"] },
    { phases: ["upcoming"], expected: ["upcoming"] },
    { phases: ["past"], expected: ["past"] },
    { phases: ["current", "upcoming"], expected: ["upcoming", "current"] },
    {
      phases: ["current", "upcoming", "past"],
      expected: ["upcoming", "current", "past"],
    },
  ] satisfies { phases: MembershipPhase[]; expected: string[] }[])(
    "時期 $phases の生徒が入る",
    ({ phases, expected }) => {
      expect(
        buildClassroomStudentIndex(STUDENTS, new Set(phases)).get(CLASSROOM.id)
      ).toEqual(expected)
    }
  )

  it("時期を1つも選ばなければ、学級から生徒は入らない", () => {
    expect(buildClassroomStudentIndex(STUDENTS, new Set()).size).toBe(0)
  })
})
