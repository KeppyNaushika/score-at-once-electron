import { Decimal } from "@prisma/client/runtime/client"

import prisma from "./client"

export interface UpsertScoreDecisionData {
  cropRegionId: string
  studentId: string
  verdict: string
  score?: number | null
  comment?: string | null
  decidedByUserId: string
  sourceQuestionScoreId?: string | null
}

/**
 * 確定権限のチェック。
 *
 * 試験に UserExam が登録されている場合は OWNER のみ確定できる。
 * UserExam が1件も無い試験（個人利用・旧データ）は制限しない。
 */
export const canDecideScore = async (
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

  const members = await prisma.userExam.findMany({
    where: { examId: cropRegion.examPage.examId },
    select: { userId: true, role: true },
  })

  // 個人利用（メンバー管理なし）の試験は制限しない
  if (members.length === 0) return { allowed: true }

  const me = members.find((m) => m.userId === userId)
  if (me?.role === "OWNER") return { allowed: true }

  return {
    allowed: false,
    reason: "採点結果の確定は試験の所有者（OWNER）のみが行えます",
  }
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

    const decision = await prisma.scoreDecision.upsert({
      where: {
        cropRegionId_studentId: {
          cropRegionId: data.cropRegionId,
          studentId: data.studentId,
        },
      },
      create: {
        cropRegionId: data.cropRegionId,
        studentId: data.studentId,
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

/** 特定の生徒×設問の確定スコアを取得する */
export const getScoreDecision = async (
  studentId: string,
  cropRegionId: string
) => {
  try {
    const decision = await prisma.scoreDecision.findUnique({
      where: {
        cropRegionId_studentId: { cropRegionId, studentId },
      },
      include: {
        decidedBy: true,
      },
    })
    return { success: true, decision }
  } catch (error) {
    console.error("Failed to get score decision:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
