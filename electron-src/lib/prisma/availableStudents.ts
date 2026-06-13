/**
 * 対象（試験・成績）に個別追加できる生徒候補の取得
 *
 * exam / grade で共有する。在籍スイッチON時は「終了していない学級所属が
 * 1件以上ある生徒のみ」に絞る（在籍は生徒単体ではなく所属レコードで決まる）。
 */

import { Prisma } from "@prisma/client"

import prisma from "./client"
import { membershipFilterAt } from "./membershipFilter"

export type AvailableStudentItem = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: { class: true }
    }
  }
}>

/**
 * 追加可能な生徒候補を返す
 *
 * @param excludeStudentIds 候補から除外する生徒ID（既に対象へ追加済みの生徒）
 * @param referenceDate 在籍判定の基準日（exam=examDate / grade=referenceDate、null可）
 * @param activeOnly true なら「終了していない所属が1件以上ある生徒」のみに絞る
 */
export async function getAvailableStudentsForTarget(params: {
  excludeStudentIds: string[]
  referenceDate: Date | null
  activeOnly: boolean
}): Promise<AvailableStudentItem[]> {
  const { excludeStudentIds, referenceDate, activeOnly } = params

  return prisma.student.findMany({
    where: {
      id:
        excludeStudentIds.length > 0 ? { notIn: excludeStudentIds } : undefined,
      // 在籍中の所属が1件以上ある生徒のみ（activeOnly時）
      ...(activeOnly
        ? { memberships: { some: membershipFilterAt(referenceDate) } }
        : {}),
    },
    include: {
      memberships: {
        include: { class: true },
        orderBy: { startDate: "desc" },
      },
    },
    orderBy: { studentNumber: "asc" },
  })
}
