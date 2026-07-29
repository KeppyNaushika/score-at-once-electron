/**
 * 対象（試験・成績）に個別追加できる生徒候補の取得
 *
 * exam / grade で共有する。在籍スイッチON時は「未在籍（所属なし）または在籍中
 * （終了していない所属が1件以上）の生徒のみ」に絞る＝過去在籍（所属はあるが全て
 * 終了済み）だけを除外する。未在籍・在籍中と過去在籍は全生徒の直和（非交和）。
 */

import { Prisma } from "@prisma/client"

import prisma from "./client"
import { membershipFilterAt } from "./membershipFilter"

type AvailableStudentItem = Prisma.StudentGetPayload<{
  include: {
    memberships: {
      include: { classroom: true }
    }
  }
}>

/**
 * 追加可能な生徒候補を返す
 *
 * @param excludeStudentIds 候補から除外する生徒ID（既に対象へ追加済みの生徒）
 * @param referenceDate 在籍判定の基準日（exam=examDate / grade=referenceDate、null可）
 * @param activeOnly true なら「未在籍・在籍中の生徒」のみに絞る（過去在籍のみ除外）
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
      // 未在籍（所属なし）または在籍中（終了していない所属が1件以上）の生徒のみ
      // （activeOnly時）。過去在籍（所属はあるが全て終了済み）だけを除外する。
      ...(activeOnly
        ? {
            OR: [
              { memberships: { none: {} } },
              { memberships: { some: membershipFilterAt(referenceDate) } },
            ],
          }
        : {}),
    },
    include: {
      memberships: {
        include: { classroom: true },
        orderBy: { startDate: "desc" },
      },
    },
    orderBy: { studentNumber: "asc" },
  })
}
