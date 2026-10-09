/**
 * AI の判定の採用（docs/vlm-grading-design.md §1・§10）。
 *
 * 採用は「実行した教員が、AI の判定を自分の判定として書き込む」こと。書く先は既存の
 * 採点の書き込み口だけで、新しい書き方は作らない。
 *
 * - 判定と部分点 → `setQuestionScore`（受験者×設問×採点者の1行）
 * - 教員向けの理由 → `setQuestionScoreComment`
 *
 * **朱書きは書かない。** AI が答案ごとに書く朱書きの文案（`AiGradingAttempt.annotationText`）は
 * 採用しない。AI が関わる朱書きは、ルーブリック項目の助言から作る経路（§4-7・§9）だけにした。
 * 前に採用した朱書きは、教員の注釈としてそのまま残る。
 *
 * **採点済みのマスは既定で飛ばす**（`overwrite: true` のときだけ上書きする）。
 * 採用できるのは実行した教員だけ（run の userId）。他の教員の判定は見比べられても、
 * その教員の名義では書けない。
 */

import { toScoringStatus } from "@/types/scoringStatus.types"

import { recordAuditLog } from "./auditLog"
import { resolveExamScopeByCropRegion } from "./auditScope"
import prisma from "./client"
import { setQuestionScoreComment } from "./questionScoreComment"
import { setQuestionScore } from "./questionScoreWrite"

/** 1件の採用 */
export interface AiGradingAdoption {
  attemptId: string
}

/** 1件ごとに何が起きたか */
export type AiGradingAdoptionOutcome =
  | "adopted"
  /** 自分の採点が既にある（overwrite でないので飛ばした） */
  | "skipped_already_scored"
  /** 実行した教員ではない */
  | "skipped_not_executor"
  /** 判定が出ていない（失敗・拒否・結果待ち） */
  | "skipped_not_succeeded"
  /** 試行が無い（消された） */
  | "skipped_not_found"

export interface AiGradingAdoptionResult {
  /** 採用なら attempt の id、白紙の採用なら examStudentId */
  targetId: string
  outcome: AiGradingAdoptionOutcome
}

/** そのマスに自分の採点が既にあり、未採点ではないか */
async function hasOwnScore(
  examStudentId: string,
  cropRegionId: string,
  userId: string
): Promise<boolean> {
  const existing = await prisma.questionScore.findFirst({
    where: { examStudentId, cropRegionId, userId },
  })
  return existing !== null && existing.status !== "unscored"
}

/** 採用1件。結果を返す（例外は呼び出し側へ） */
async function adoptOne(
  adoption: AiGradingAdoption,
  actorUserId: string,
  overwrite: boolean
): Promise<{ outcome: AiGradingAdoptionOutcome; cropRegionId: string | null }> {
  const attempt = await prisma.aiGradingAttempt.findUnique({
    where: { id: adoption.attemptId },
    include: { run: { include: { prompt: true } } },
  })
  if (!attempt) return { outcome: "skipped_not_found", cropRegionId: null }
  const cropRegionId = attempt.run.prompt.cropRegionId
  if (attempt.run.userId !== actorUserId) {
    return { outcome: "skipped_not_executor", cropRegionId }
  }
  if (attempt.state !== "succeeded") {
    return { outcome: "skipped_not_succeeded", cropRegionId }
  }
  const { examStudentId } = attempt
  const target = { examStudentId, cropRegionId, userId: actorUserId }

  if (
    !overwrite &&
    (await hasOwnScore(examStudentId, cropRegionId, actorUserId))
  ) {
    return { outcome: "skipped_already_scored", cropRegionId }
  }

  const questionScore = await setQuestionScore({
    ...target,
    status: toScoringStatus(attempt.status),
    partialScore:
      attempt.partialScore === null ? null : attempt.partialScore.toNumber(),
  })
  await setQuestionScoreComment({ ...target, comment: attempt.comment })

  await prisma.aiGradingAttempt.update({
    where: { id: attempt.id },
    data: { adoptedQuestionScoreId: questionScore.id, adoptedAt: new Date() },
  })
  return { outcome: "adopted", cropRegionId }
}

/** 採用した件数を、設問ごとに1行の監査ログにまとめる */
async function recordAdoptionAudit(
  actorUserId: string,
  adoptedCountByCropRegion: Map<string, number>
): Promise<void> {
  for (const [cropRegionId, adoptedCount] of adoptedCountByCropRegion) {
    const scope = await resolveExamScopeByCropRegion(cropRegionId)
    await recordAuditLog({
      action: "exam.ai_grading.adopt",
      userId: actorUserId,
      entityType: "CropRegion",
      entityId: cropRegionId,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: `AI の判定を${adoptedCount}件、採点に採用しました`,
    })
  }
}

/**
 * 選んだ試行を、実行した教員自身の採点として書き込む。
 *
 * 1件ずつ既存の書き込み口を順に呼ぶ（1件の中で途中まで書けて失敗したら、その件は
 * そこで止まり、例外が呼び出し側へ上がる。それまでの件は書けている）。
 */
export async function adoptAiGradingAttempts(
  input: {
    adoptions: readonly AiGradingAdoption[]
    overwrite: boolean
  },
  actorUserId: string
): Promise<AiGradingAdoptionResult[]> {
  const results: AiGradingAdoptionResult[] = []
  const adoptedCountByCropRegion = new Map<string, number>()
  try {
    for (const adoption of input.adoptions) {
      const { outcome, cropRegionId } = await adoptOne(
        adoption,
        actorUserId,
        input.overwrite
      )
      results.push({ targetId: adoption.attemptId, outcome })
      if (outcome === "adopted" && cropRegionId) {
        adoptedCountByCropRegion.set(
          cropRegionId,
          (adoptedCountByCropRegion.get(cropRegionId) ?? 0) + 1
        )
      }
    }
  } finally {
    await recordAdoptionAudit(actorUserId, adoptedCountByCropRegion)
  }
  return results
}
