/**
 * resolveExamClassroomPlacement（renderer 側の採番学級リゾルバ）の単体テスト
 *
 * 受験日スナップショット絞り込みは main の getAdministeredClassrooms が担うため、ここでは
 * 純関数としての「order 昇順の first-match-wins」と lean な出力を検証する
 * （受験日絞り込みとの結合は examStudentClass.test.ts の統合テストで担保）。
 */

import { describe, expect, it } from "vitest"

import type { ExamClassroomWithMemberships } from "@/electron-src/lib/prisma/examClassroom"
import { resolveExamClassroomPlacement } from "@/lib/examClassroomPlacement"

/** テスト用の administered ExamClassroom を最小構成で組み立てる */
function buildExamClassroom(
  order: number,
  classroom: { id: string; name: string; grade: number | null },
  members: Array<{ studentId: string; attendanceNumber: number | null }>
): ExamClassroomWithMemberships {
  return {
    id: `ec-${classroom.id}`,
    examId: "exam-1",
    classroomId: classroom.id,
    administered: true,
    teacherStatistics: true,
    studentReport: true,
    order,
    createdAt: new Date("2024-04-01"),
    updatedAt: new Date("2024-04-01"),
    classroom: {
      id: classroom.id,
      name: classroom.name,
      grade: classroom.grade,
      classroomCode: null,
      createdAt: new Date("2024-04-01"),
      updatedAt: new Date("2024-04-01"),
      memberships: members.map((member) => ({
        id: `m-${classroom.id}-${member.studentId}`,
        studentId: member.studentId,
        classroomId: classroom.id,
        attendanceNumber: member.attendanceNumber,
        startDate: new Date("2024-04-01"),
        endDate: null,
        createdAt: new Date("2024-04-01"),
        updatedAt: new Date("2024-04-01"),
        // resolver は student を参照しないため最小限で補う
        student: { id: member.studentId } as unknown,
      })),
    },
    // ExamClassroomWithMemberships は exam を含まないためこのままでよい
  } as unknown as ExamClassroomWithMemberships
}

describe("resolveExamClassroomPlacement", () => {
  it("生徒が複数の administered 学級に所属する場合、order 昇順で最初の学級を採番学級にする", () => {
    // 意図的に配列順は order 昇順にしない（リゾルバが order で並べ直すことを検証）
    const administeredClassrooms = [
      buildExamClassroom(1, { id: "clubB", name: "バスケ部", grade: 3 }, [
        { studentId: "s1", attendanceNumber: 7 },
      ]),
      buildExamClassroom(0, { id: "classroomA", name: "3年A組", grade: 3 }, [
        { studentId: "s1", attendanceNumber: 1 },
        { studentId: "s2", attendanceNumber: 2 },
      ]),
    ]

    const placement = resolveExamClassroomPlacement(administeredClassrooms)

    // s1 は order=0 の classroomA が採番学級（clubB ではない）
    expect(placement["s1"].classroom?.name).toBe("3年A組")
    expect(placement["s1"].attendanceNumber).toBe(1)
    expect(placement["s1"].order).toBe(0)

    // s2 は classroomA のみ
    expect(placement["s2"].classroom?.name).toBe("3年A組")
    expect(placement["s2"].attendanceNumber).toBe(2)

    // 採番学級に memberships は同梱しない（Classroom スカラーのみ）
    expect(
      (placement["s1"].classroom as unknown as { memberships?: unknown })
        .memberships
    ).toBeUndefined()
  })

  it("administered 学級が空なら空のマップを返す", () => {
    expect(resolveExamClassroomPlacement([])).toEqual({})
  })
})
