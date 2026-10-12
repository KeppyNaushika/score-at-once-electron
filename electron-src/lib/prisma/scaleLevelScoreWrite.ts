/**
 * 類型評価の設問で、自分の採点行に類型を付ける・外す（docs/vlm-grading-design.md §4-8-2・§4-8-6）。
 *
 * 類型を付けた行は `status` を `evaluated`、`scaleLevelId` をその類型、`partialScore` を null にする。
 * 点は書かない（読むときに類型の点数を引く）。外すと `unscored` に戻し、類型も null にする。
 *
 * 点の採点の書き込み（`questionScoreWrite.ts`）とは口を分ける。あちらは判定と部分点の
 * 「1つの決定」を受け、類型を書かない（書くときは類型を null に戻す）。ここは類型だけを受ける。
 *
 * 付けられるのは、その設問が使っている類型評価の類型だけ。採点者は認証ストアの操作者で、
 * renderer から利用者 id を受け取らない（ルーブリック採点の書き込みと同じ）。
 */

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import { cropRegionAuditTarget } from "./auditTargets"
import prisma from "./client"
import { assertCropRegionsInSameExam } from "./examScopeGuard"

export interface SetScaleLevelsInput {
  cropRegionId: string
  examStudentIds: string[]
  /** 付ける類型。null なら外す（未採点に戻す） */
  scaleLevelId: string | null
}

/**
 * 類型をまとめて付ける・外す。書いた採点行を返す（外したときに行が無かったマスは返さない）
 */
export async function setScaleLevels(
  input: SetScaleLevelsInput,
  actorUserId: string
) {
  if (input.examStudentIds.length === 0) return []
  await assertCropRegionsInSameExam(
    input.examStudentIds.map((examStudentId) => ({
      cropRegionId: input.cropRegionId,
      examStudentId,
    }))
  )

  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: input.cropRegionId },
  })
  if (!cropRegion) throw new Error("採点領域が見つかりません")
  const scaleLevel =
    input.scaleLevelId === null
      ? null
      : await prisma.scoreScaleLevel.findUnique({
          where: { id: input.scaleLevelId },
        })
  if (input.scaleLevelId !== null) {
    if (!scaleLevel) throw new Error("類型が見つかりません")
    if (scaleLevel.scaleId !== cropRegion.scoreScaleId) {
      throw new Error("この設問の類型表の類型ではありません")
    }
  }

  const existingRows = await prisma.questionScore.findMany({
    where: {
      cropRegionId: input.cropRegionId,
      userId: actorUserId,
      examStudentId: { in: input.examStudentIds },
    },
  })
  const existingByExamStudentId = new Map(
    existingRows.map((row) => [row.examStudentId, row])
  )

  const written = []
  for (const examStudentId of input.examStudentIds) {
    const existing = existingByExamStudentId.get(examStudentId)
    if (scaleLevel === null) {
      if (!existing) continue
      written.push(
        await prisma.questionScore.update({
          where: { id: existing.id },
          data: {
            status: "unscored",
            scaleLevelId: null,
            partialScore: null,
            overridesRubric: false,
          },
        })
      )
      continue
    }
    written.push(
      existing
        ? await prisma.questionScore.update({
            where: { id: existing.id },
            data: {
              status: "evaluated",
              scaleLevelId: scaleLevel.id,
              partialScore: null,
              overridesRubric: false,
            },
          })
        : await prisma.questionScore.create({
            data: {
              cropRegionId: input.cropRegionId,
              examStudentId,
              userId: actorUserId,
              status: "evaluated",
              scaleLevelId: scaleLevel.id,
              partialScore: null,
            },
          })
    )
  }

  if (written.length > 0) {
    const scope = await resolveExamScopeByCropRegion(input.cropRegionId)
    await recordAuditLog({
      action: "exam.score.evaluate",
      userId: actorUserId,
      entityType: "QuestionScore",
      entityId: input.cropRegionId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary:
        scaleLevel === null
          ? `「${cropRegion.label}」の類型を外しました（${written.length}件）`
          : `「${cropRegion.label}」に類型「${scaleLevel.label}」を付けました（${written.length}件）`,
      targets: [cropRegionAuditTarget(cropRegion)],
      extra: { count: written.length },
    })
  }
  return written
}
