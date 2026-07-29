import { Decimal } from "@prisma/client/runtime/client"

import { recordAuditLog } from "./auditLog"
import {
  resolveExamScopeByCropRegion,
  resolveExamStudentLabel,
} from "./auditScope"
import prisma from "./client"
import { assertCropRegionsInSameExam } from "./examScopeGuard"

/** verdict コードを日本語表示に変換（監査ログ差分用） */
const verdictLabel = (verdict: string | null | undefined): string => {
  switch (verdict) {
    case "correct":
      return "正解"
    case "incorrect":
      return "不正解"
    case "partial":
      return "部分点"
    case "pending":
      return "保留"
    case "no_answer":
      return "無答"
    case "double_mark":
      return "複数マーク"
    default:
      return verdict ?? "（なし）"
  }
}

export interface UpsertScoreDecisionData {
  cropRegionId: string
  examStudentId: string
  verdict: string
  score?: number | null
  comment?: string | null
  decidedByUserId: string
  sourceQuestionScoreId?: string | null
}

/**
 * 試験単位の確定権限チェック。
 *
 * 試験に UserExam が登録されている場合は OWNER のみ確定できる。
 * UserExam が1件も無い試験（旧データ）は制限しない
 * — createExam / アーカイブインポートは作成者を必ず OWNER として登録するため、
 * 新規試験でこのフォールバックに入ることはない。
 */
export const canDecideExamScores = async (
  examId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const members = await prisma.userExam.findMany({
    where: { examId },
    select: { userId: true, role: true },
  })

  // メンバー管理なしの旧データは制限しない
  if (members.length === 0) return { allowed: true }

  const currentMember = members.find((member) => member.userId === userId)
  if (currentMember?.role === "OWNER") return { allowed: true }

  return {
    allowed: false,
    reason: "採点結果の確定は試験の所有者（OWNER）のみが行えます",
  }
}

/** 設問（採点領域）から試験を引いて確定権限をチェックする */
const canDecideScore = async (
  cropRegionId: string,
  userId: string
): Promise<{ allowed: boolean; reason?: string }> => {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: cropRegionId },
    select: { examPage: { select: { examId: true } } },
  })
  if (!cropRegion) {
    return { allowed: false, reason: "採点領域が見つかりません" }
  }

  return canDecideExamScores(cropRegion.examPage.examId, userId)
}

/**
 * 確定スコアをupsertする（生徒×設問ごとに1行）。
 *
 * 削除・再作成はしない — LWW同期でセカンダリUNIQUEにより単一行へ収束させるため、
 * 同一セルの確定は常に既存行のin-place更新で表現する。
 */
export const upsertScoreDecision = async (data: UpsertScoreDecisionData) => {
  try {
    const permission = await canDecideScore(
      data.cropRegionId,
      data.decidedByUserId
    )
    if (!permission.allowed) {
      return { success: false, error: permission.reason ?? "権限がありません" }
    }

    const score =
      data.score !== null && data.score !== undefined
        ? new Decimal(data.score)
        : null

    // 採点領域と受験者が同じ試験のものであること（FK は片方ずつしか見ない）
    await assertCropRegionsInSameExam([
      {
        cropRegionId: data.cropRegionId,
        examStudentId: data.examStudentId,
      },
    ])

    // 差分記録用に変更前の確定を取得
    const previous = await prisma.scoreDecision.findUnique({
      where: {
        cropRegionId_examStudentId: {
          cropRegionId: data.cropRegionId,
          examStudentId: data.examStudentId,
        },
      },
      select: { verdict: true, score: true },
    })

    const decision = await prisma.scoreDecision.upsert({
      where: {
        cropRegionId_examStudentId: {
          cropRegionId: data.cropRegionId,
          examStudentId: data.examStudentId,
        },
      },
      create: {
        cropRegionId: data.cropRegionId,
        examStudentId: data.examStudentId,
        verdict: data.verdict,
        score,
        comment: data.comment ?? null,
        decidedByUserId: data.decidedByUserId,
        decidedAt: new Date(),
        sourceQuestionScoreId: data.sourceQuestionScoreId ?? null,
      },
      update: {
        verdict: data.verdict,
        score,
        comment: data.comment ?? null,
        decidedByUserId: data.decidedByUserId,
        decidedAt: new Date(),
        sourceQuestionScoreId: data.sourceQuestionScoreId ?? null,
      },
      include: {
        decidedBy: true,
      },
    })

    // 監査ログ: 採点確定（OWNERによる確定。提案連打は記録しない）
    const scope = await resolveExamScopeByCropRegion(data.cropRegionId)
    const studentLabel = await resolveExamStudentLabel(data.examStudentId)
    const prevScore = previous?.score != null ? Number(previous.score) : null
    const newScore = score != null ? Number(score) : null
    await recordAuditLog({
      action: "exam.score.decide",
      userId: data.decidedByUserId,
      entityType: "ScoreDecision",
      entityId: decision.id,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      summary: studentLabel
        ? `「${studentLabel}」の採点を確定しました`
        : "採点を確定しました",
      changes: [
        {
          field: "verdict",
          label: "判定",
          before: previous ? verdictLabel(previous.verdict) : null,
          after: verdictLabel(data.verdict),
        },
        { field: "score", label: "得点", before: prevScore, after: newScore },
      ],
    })

    return { success: true, decision }
  } catch (error) {
    console.error("Failed to upsert score decision:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 試験の全確定スコアを取得する */
export const getScoreDecisionsForExam = async (examId: string) => {
  try {
    const decisions = await prisma.scoreDecision.findMany({
      where: {
        cropRegion: {
          examPage: { examId },
        },
      },
      include: {
        decidedBy: true,
      },
    })
    return { success: true, decisions }
  } catch (error) {
    console.error("Failed to get score decisions for exam:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
