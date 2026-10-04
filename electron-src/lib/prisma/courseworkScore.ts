/**
 * Coursework の点数（CourseworkScore）の Prisma 操作関数
 *
 * 点数の主語は「その資料の対象者」（CourseworkStudent）であり、人（Student）ではない。
 */

import type { CourseworkScoreUpsertInput } from "../../../src/types/coursework.types"
import { recordAuditLog } from "./auditLog"
import {
  resolveCourseworkScopeByItem,
  resolveCourseworkStudentTargets,
} from "./auditScope"
import prisma from "./client"
import { serializePrisma } from "./serializePrisma"

/** 評価項目の全点数（資料の対象者・生徒情報付き）を取得 */
export async function getCourseworkScoresByItemId(courseworkItemId: string) {
  const scores = await prisma.courseworkScore.findMany({
    where: { courseworkItemId },
    include: {
      courseworkStudent: { include: { student: true } },
    },
    orderBy: { courseworkStudent: { student: { studentNumber: "asc" } } },
  })
  return serializePrisma(scores)
}

/**
 * 評価項目と対象者が同じ資料に属していることを確かめる。
 *
 * FK は「CourseworkItem が実在すること」「CourseworkStudent が実在すること」しか
 * 保証せず、両者が同じ Coursework に属することは強制しない。食い違ったまま書けると、
 * 資料 A の項目に資料 B の名簿の生徒の点数がぶら下がり、A の名簿に居ない生徒の点数が
 * 成績算出に算入される — #962 で塞いだのと同じ穴が別の入口から開く。
 */
async function assertSameCoursework(
  scores: CourseworkScoreUpsertInput[]
): Promise<void> {
  const [items, courseworkStudents] = await Promise.all([
    prisma.courseworkItem.findMany({
      where: {
        id: {
          in: [...new Set(scores.map((score) => score.courseworkItemId))],
        },
      },
    }),
    prisma.courseworkStudent.findMany({
      where: {
        id: {
          in: [...new Set(scores.map((score) => score.courseworkStudentId))],
        },
      },
    }),
  ])
  const courseworkIdByItem = new Map(
    items.map((item) => [item.id, item.courseworkId])
  )
  const courseworkIdByStudent = new Map(
    courseworkStudents.map((courseworkStudent) => [
      courseworkStudent.id,
      courseworkStudent.courseworkId,
    ])
  )

  for (const score of scores) {
    const itemCourseworkId = courseworkIdByItem.get(score.courseworkItemId)
    const studentCourseworkId = courseworkIdByStudent.get(
      score.courseworkStudentId
    )
    if (!itemCourseworkId || !studentCourseworkId) {
      throw new Error("評価項目または対象生徒が見つかりません")
    }
    if (itemCourseworkId !== studentCourseworkId) {
      throw new Error("評価項目と対象生徒が別の試験外成績資料に属しています")
    }
  }
}

/**
 * 点数を一括更新（upsert）。各フィールドは optional（セル単位編集対応）。
 *
 * 点数の主語は「その資料の対象者」（CourseworkStudent）であり、人（Student）ではない。
 * 名簿に載っていない生徒の点数は書けない（FK が拒否する）。
 */
export async function batchUpsertCourseworkScores(
  scores: CourseworkScoreUpsertInput[]
) {
  if (scores.length > 0) await assertSameCoursework(scores)

  await prisma.$transaction(
    scores.map((score) => {
      const fields: {
        score?: number | null
        letterValue?: string | null
        adjustment?: number | null
        adjustmentReason?: string | null
        comment?: string | null
      } = {}
      if (score.score !== undefined) fields.score = score.score
      if (score.letterValue !== undefined)
        fields.letterValue = score.letterValue
      if (score.adjustment !== undefined) fields.adjustment = score.adjustment
      if (score.adjustmentReason !== undefined)
        fields.adjustmentReason = score.adjustmentReason
      if (score.comment !== undefined) fields.comment = score.comment

      return prisma.courseworkScore.upsert({
        where: {
          courseworkItemId_courseworkStudentId: {
            courseworkItemId: score.courseworkItemId,
            courseworkStudentId: score.courseworkStudentId,
          },
        },
        create: {
          courseworkItemId: score.courseworkItemId,
          courseworkStudentId: score.courseworkStudentId,
          ...fields,
        },
        update: fields,
      })
    })
  )

  if (scores.length > 0) {
    const scope = await resolveCourseworkScopeByItem(scores[0].courseworkItemId)
    await recordAuditLog({
      action: "coursework.score.update",
      entityType: "CourseworkScore",
      entityId: scores[0].courseworkItemId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `資料の点数を更新しました（${scores.length}件）`,
      extra: { count: scores.length },
      targets: await resolveCourseworkStudentTargets([
        ...new Set(scores.map((score) => score.courseworkStudentId)),
      ]),
    })
  }
}
