/**
 * AI 採点の問いかけで決めた点の検証・書き込みと、答えを確定済みにする操作
 * （docs/vlm-grading-design.md §3-5）。
 *
 * 問いかけで決めたことは下書き（AI の層の答えの行）で、確定のときに初めて教員の層へ書く。
 * 項目から計算する点は renderer が `writeRubricScores` で書き、ここで書くのは
 * **教員が直接決めた点**（1件ずつ採点した点・採点チェックで直すと決めた点）だけ。書き方は採点キーと
 * 同じ（`setQuestionScore`。適用のあるマスでは手での上書きになる）。
 */

import { Prisma } from "@prisma/client"

import {
  isScoringStatus,
  type ScoringStatus,
} from "@/types/scoringStatus.types"

import prisma from "./client"
import { setQuestionScore } from "./questionScoreWrite"

/** 問いかけで答案（試行）に付ける点 */
export interface QuestioningScoreInput {
  attemptId: string
  status: ScoringStatus
  /** partial / pending のときの点。それ以外は null */
  partialScore: number | null
}

/**
 * 付ける点を検証する。判定は採点の判定の集合に入り、点は partial / pending だけが持ち、
 * 0〜配点・0.01 単位に収まる（配点の無い設問では点を持てない）
 */
export function assertQuestioningScores(
  scores: readonly Pick<QuestioningScoreInput, "status" | "partialScore">[],
  points: number | null
): void {
  for (const score of scores) {
    if (!isScoringStatus(score.status)) {
      throw new Error(`採点の判定「${String(score.status)}」は使えません`)
    }
    if (score.partialScore === null) continue
    if (score.status !== "partial" && score.status !== "pending") {
      throw new Error("部分点・保留のほかは点を持ちません")
    }
    const isCent =
      Math.abs(
        score.partialScore * 100 - Math.round(score.partialScore * 100)
      ) < 1e-6
    if (
      points === null ||
      score.partialScore < 0 ||
      score.partialScore > points ||
      !isCent
    ) {
      throw new Error("点は 0 から配点までの、0.01 単位で付けてください")
    }
  }
}

/** 確定のときに書く1マス */
export interface AiQuestioningScoreWrite {
  examStudentId: string
  status: ScoringStatus
  partialScore: number | null
}

/**
 * 問いかけで教員が直接決めた点を、操作者自身の採点として書く（採点キーと同じ書き方。
 * 行が無ければ作る。適用のあるマスでは手での上書きになる）。1件ずつ順に書く
 */
export async function writeAiQuestioningScores(
  input: { cropRegionId: string; scores: AiQuestioningScoreWrite[] },
  actorUserId: string
): Promise<number> {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: input.cropRegionId },
  })
  if (!cropRegion) throw new Error("設問が見つかりません")
  assertQuestioningScores(input.scores, cropRegion.points)
  for (const score of input.scores) {
    await setQuestionScore({
      examStudentId: score.examStudentId,
      cropRegionId: input.cropRegionId,
      userId: actorUserId,
      status: score.status,
      partialScore: score.partialScore,
    })
  }
  return input.scores.length
}

/**
 * 答え（下書き）を確定済みにする。教員の層へ書き終えた答えだけを渡す（1件ずつ採点した案の答えと、
 * 案の外の問いかけの答え）。他の教員の答えと、確定済みの答えは変えない
 */
export async function markAiQuestioningCommitted(
  input: { proposalResponseIds: string[]; attemptResponseIds: string[] },
  actorUserId: string
): Promise<void> {
  const committedAt = new Date()
  await prisma.$transaction([
    prisma.aiRubricProposalResponse.updateMany({
      where: {
        id: { in: input.proposalResponseIds },
        committedAt: null,
        proposal: { run: { userId: actorUserId } },
      },
      data: { committedAt },
    }),
    prisma.aiAttemptResponse.updateMany({
      where: {
        id: { in: input.attemptResponseIds },
        committedAt: null,
        attempt: { run: { userId: actorUserId } },
      },
      data: { committedAt },
    }),
  ])
}

/** 点を Decimal の列へ */
export const toPartialScoreColumn = (
  partialScore: number | null
): Prisma.Decimal | null =>
  partialScore === null ? null : new Prisma.Decimal(partialScore)
