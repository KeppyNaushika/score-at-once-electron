/**
 * 対象（試験・成績）に追加できる学級候補の取得
 *
 * exam / grade で共有する。「在籍生徒のいる学級だけ表示」を実現するため、
 * 既に対象へ追加済みの生徒を除いた在籍生徒数で 0名学級を非表示にする。
 */

import prisma from "./client"
import { membershipFilterAt } from "./membershipFilter"

interface AvailableClassroomItem {
  id: string
  name: string
  classroomCode: string | null
  grade: number | null
  /** この学級から新たに追加できる在籍生徒数（対象に未追加かつ activeOnly 条件を満たす生徒の人数） */
  studentCount: number
  /** 追加対象の生徒名（出席番号順、tooltip表示用） */
  studentNames: string[]
}

/**
 * 追加可能な学級候補を返す
 *
 * @param existingClassroomIds 候補から除外する学級ID（成績の GradeClassroom など、既に紐付け済みの学級）
 * @param excludeStudentIds 人数カウントから除外する生徒ID（既に対象へ追加済みの生徒）
 * @param referenceDate 在籍判定の基準日（exam=examDate / grade=referenceDate、null可）
 * @param activeOnly true なら基準日時点で在籍中（終了していない所属）の生徒のみ数える
 *
 * いずれの場合も、追加できる在籍生徒が0名の学級は候補から除外する。
 */
export async function getAvailableClassroomsForTarget(params: {
  existingClassroomIds: string[]
  excludeStudentIds: string[]
  referenceDate: Date | null
  activeOnly: boolean
}): Promise<AvailableClassroomItem[]> {
  const { existingClassroomIds, excludeStudentIds, referenceDate, activeOnly } =
    params
  const excluded = new Set(excludeStudentIds)

  const classrooms = await prisma.classroom.findMany({
    where:
      existingClassroomIds.length > 0
        ? { id: { notIn: existingClassroomIds } }
        : undefined,
    include: {
      memberships: {
        where: activeOnly ? membershipFilterAt(referenceDate) : undefined,
        select: {
          studentId: true,
          student: { select: { lastName: true, firstName: true } },
        },
        orderBy: [{ attendanceNumber: "asc" }],
      },
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  })

  return classrooms
    .map((classroom) => {
      // 同一生徒の複数在籍歴を重複カウントせず、対象に未追加の生徒だけ集める
      const seen = new Set<string>()
      const studentNames: string[] = []
      for (const membership of classroom.memberships) {
        if (
          excluded.has(membership.studentId) ||
          seen.has(membership.studentId)
        )
          continue
        seen.add(membership.studentId)
        studentNames.push(
          `${membership.student.lastName} ${membership.student.firstName}`
        )
      }
      return {
        id: classroom.id,
        name: classroom.name,
        classroomCode: classroom.classroomCode,
        grade: classroom.grade,
        studentCount: studentNames.length,
        studentNames,
      }
    })
    .filter((classroom) => classroom.studentCount > 0)
}
