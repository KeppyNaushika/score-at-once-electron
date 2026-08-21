/**
 * 対象（試験・成績・試験外成績資料）に追加できる学級候補の取得
 *
 * exam / grade / coursework で共有する。「在籍生徒のいる学級だけ表示」を実現するため、
 * 既に対象へ追加済みの生徒を除いた在籍が1件も無い学級を候補から外す。
 */

import type { Prisma } from "@prisma/client"

import type { ClassroomWithMemberships } from "@/types/prismaExtensions"

import prisma from "./client"
import { membershipFilterAt } from "./membershipFilter"

/**
 * 追加可能な学級候補を返す
 *
 * @param existingClassroomIds 候補から除外する学級ID（成績の GradeClassroom など、既に紐付け済みの学級）
 * @param excludeStudentIds 候補から除外する生徒ID（既に対象へ追加済みの生徒）
 * @param referenceDate 在籍判定の基準日（exam=examDate / grade=referenceDate、null可）
 * @param activeOnly true なら基準日時点で在籍中（終了していない所属）の生徒のみ候補にする
 *
 * 学級（Classroom）の木を、追加できる在籍とその生徒を同梱したまま返す。
 * 「何名か」「誰がいるか」は memberships から表示側が導く（main では数えない）。
 * 同一生徒が複数の在籍歴で現れうるので、人数・氏名は studentId で畳んでから読むこと。
 *
 * 追加できる在籍が0名の学級は、`memberships.some` で**問い合わせの段階から**候補に含めない。
 * 絞りは main の where が1箇所で持ち、表示側は数えるだけにする。
 */
export async function getAvailableClassroomsForTarget(params: {
  existingClassroomIds: string[]
  excludeStudentIds: string[]
  referenceDate: Date | null
  activeOnly: boolean
}): Promise<ClassroomWithMemberships[]> {
  const { existingClassroomIds, excludeStudentIds, referenceDate, activeOnly } =
    params

  /** この学級から新たに追加できる在籍の条件（在籍期間 ＋ 対象に未追加） */
  const addableMembershipFilter: Prisma.StudentClassroomMembershipWhereInput = {
    ...(activeOnly ? membershipFilterAt(referenceDate) : {}),
    ...(excludeStudentIds.length > 0
      ? { studentId: { notIn: excludeStudentIds } }
      : {}),
  }

  return prisma.classroom.findMany({
    where: {
      ...(existingClassroomIds.length > 0
        ? { id: { notIn: existingClassroomIds } }
        : {}),
      // 追加できる在籍が1件も無い学級（0名）は候補に出さない
      memberships: { some: addableMembershipFilter },
    },
    include: {
      memberships: {
        where: addableMembershipFilter,
        include: { student: true },
        orderBy: [{ attendanceNumber: "asc" }],
      },
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  })
}
