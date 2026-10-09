/**
 * ルーブリック項目から計算した点を、採点行（QuestionScore）の status / partialScore に書く
 * （docs/vlm-grading-design.md §4-4・§4-6）。
 *
 * 計算は renderer が行い、ここは受け取った結果を書くだけ。書いた行は「項目から計算した点」
 * なので、手での上書き（`overridesRubric`）を外す。
 *
 * **他の採点者の行も書く。** 項目は共有で、ある教員が項目の値を変えると、その項目を当てている
 * 他の採点者の点も計算し直す（§4-6）。
 *
 * 楽観的ロックの列は無い（QuestionScore の他の書き込みと同じ。`updateQuestionScore`）。
 * 代わりに次の2つを守る。
 * - 行がもう無い（答案ごと消された）なら飛ばし、`deletedQuestionScoreIds` で返す
 * - renderer が読んだあとに採点キーで上書きされた行（`overridesRubric` が立っている）は、
 *   上書きを解除する指示（`clearsOverride`）が無ければ飛ばし、`skippedOverriddenIds` で返す
 */

import { Prisma } from "@prisma/client"

import {
  isScoringStatus,
  type ScoringStatus,
} from "@/types/scoringStatus.types"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"

/** 1マス分の書き込み */
export interface RubricScoreWrite {
  questionScoreId: string
  status: ScoringStatus
  /** 部分点。判定そのものが点を決めるときは null */
  partialScore: number | null
  /** 手での上書きを解除して書く（上書きを解除する操作のとき true） */
  clearsOverride: boolean
}

export interface WriteRubricScoresResult {
  writtenQuestionScoreIds: string[]
  deletedQuestionScoreIds: string[]
  skippedOverriddenIds: string[]
}

/** 項目から計算した点をまとめて書く（1つのトランザクション） */
export async function writeRubricScores(
  writes: RubricScoreWrite[],
  actorUserId: string
): Promise<WriteRubricScoresResult> {
  for (const write of writes) {
    if (!isScoringStatus(write.status)) {
      throw new Error(`採点の判定「${String(write.status)}」は使えません`)
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingRows = await tx.questionScore.findMany({
      where: { id: { in: writes.map((write) => write.questionScoreId) } },
    })
    const existingById = new Map(existingRows.map((row) => [row.id, row]))
    const written: { id: string; userId: string; cropRegionId: string }[] = []
    const deletedQuestionScoreIds: string[] = []
    const skippedOverriddenIds: string[] = []

    for (const write of writes) {
      const existing = existingById.get(write.questionScoreId)
      if (!existing) {
        deletedQuestionScoreIds.push(write.questionScoreId)
        continue
      }
      if (existing.overridesRubric && !write.clearsOverride) {
        skippedOverriddenIds.push(write.questionScoreId)
        continue
      }
      await tx.questionScore.update({
        where: { id: write.questionScoreId },
        data: {
          status: write.status,
          partialScore:
            write.partialScore === null
              ? null
              : new Prisma.Decimal(write.partialScore),
          overridesRubric: false,
        },
      })
      written.push(existing)
    }
    return { written, deletedQuestionScoreIds, skippedOverriddenIds }
  })

  await recordRubricScoreAudit(result.written, actorUserId)

  return {
    writtenQuestionScoreIds: result.written.map((row) => row.id),
    deletedQuestionScoreIds: result.deletedQuestionScoreIds,
    skippedOverriddenIds: result.skippedOverriddenIds,
  }
}

/**
 * 監査ログ。自分の行と他の採点者の行を分けて、それぞれ1件にまとめる
 * （他の採点者の点の計算し直しは、設計 §5-2 で残すと決めた操作）
 */
async function recordRubricScoreAudit(
  written: { id: string; userId: string; cropRegionId: string }[],
  actorUserId: string
): Promise<void> {
  if (written.length === 0) return
  const scope = await resolveExamScopeByCropRegion(written[0].cropRegionId)
  const ownRows = written.filter((row) => row.userId === actorUserId)
  const otherRows = written.filter((row) => row.userId !== actorUserId)

  if (ownRows.length > 0) {
    await recordAuditLog({
      action: "exam.score.rubric",
      userId: actorUserId,
      entityType: "QuestionScore",
      entityId: ownRows[0].cropRegionId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `ルーブリック項目から採点を反映しました（${ownRows.length}件）`,
      extra: { count: ownRows.length },
    })
  }
  if (otherRows.length > 0) {
    const otherUserCount = new Set(otherRows.map((row) => row.userId)).size
    await recordAuditLog({
      action: "exam.rubric.recalculate_others",
      userId: actorUserId,
      entityType: "QuestionScore",
      entityId: otherRows[0].cropRegionId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `ルーブリック項目の変更で、他の採点者${otherUserCount}名の点を計算し直しました（${otherRows.length}件）`,
      extra: { count: otherRows.length, userCount: otherUserCount },
    })
  }
}
