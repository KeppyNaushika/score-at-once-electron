/**
 * AI採点の問いかけで決めた点の検証・書き込みと、答えを確定済みにする操作
 * （docs/vlm-grading-design.md §3-5）。
 *
 * 問いかけで決めたことは下書き（AI の層の答えの行）で、確定のときに初めて教員の層へ書く。
 * 項目から計算する点は renderer が `writeRubricScores` で書き、ここで書くのは
 * **教員が直接決めた点**（自分で採点した点・AIチェックで直すと決めた点）だけ。書き方は採点キーと
 * 同じ（`setQuestionScore`。適用のあるマスでは手での上書きになる）。
 *
 * 類型方式の設問（docs/vlm-grading-design.md §4-8-6）では、類型を付ける点（`evaluated`）は類型の書き込み
 * （`setScaleLevels`）で書く。付けられるのは設問の類型表の類型だけで、点は持たない。設問の方式と
 * 合わない判定（類型方式の設問の正答・誤答・部分点、ほかの設問の類型採点済み）は拒む。
 */

import { Prisma } from "@prisma/client"

import {
  isStatusCompatibleWithScoringMethod,
  toScoringMethod,
} from "@/types/rubric.types"
import {
  isScoringStatus,
  type ScoringStatus,
} from "@/types/scoringStatus.types"

import prisma from "./client"
import { setQuestionScore } from "./questionScoreWrite"
import { setScaleLevels } from "./scaleLevelScoreWrite"

/** 問いかけで答案（試行）に付ける点 */
export interface QuestioningScoreInput {
  attemptId: string
  status: ScoringStatus
  /** partial / pending のときの点。それ以外は null */
  partialScore: number | null
  /** 類型方式の設問で付ける類型（evaluated のときだけ）。それ以外は null */
  scaleLevelId: string | null
}

/** 付ける点の検証が読む設問の値 */
export interface QuestioningScoreRegion {
  /** 設問の配点（CropRegion.points）。配点の無い設問は null */
  points: number | null
  /** CropRegion.scoringMethod（DB の文字列のまま） */
  scoringMethod: string
  /** 設問が今使っている類型表の類型の id（類型方式でない・類型表の無い設問は空） */
  scaleLevelIds: readonly string[]
}

/** 検証の材料にする設問の木（配点・方式と、類型表の類型） */
export const questioningRegionInclude = {
  scoreScale: { include: { levels: true } },
} satisfies Prisma.CropRegionInclude

/** 設問の行（類型表の類型付き）から、検証が読む値へ */
export function toQuestioningScoreRegion(
  cropRegion: Prisma.CropRegionGetPayload<{
    include: typeof questioningRegionInclude
  }>
): QuestioningScoreRegion {
  return {
    points: cropRegion.points,
    scoringMethod: cropRegion.scoringMethod,
    scaleLevelIds:
      cropRegion.scoreScale?.levels.map((scaleLevel) => scaleLevel.id) ?? [],
  }
}

/**
 * 付ける点を検証する。判定は採点の判定の集合に入り、設問の方式と合う。点は partial / pending だけが持ち、
 * 0〜配点・0.01 単位に収まる（配点の無い設問では点を持てない）。類型方式の設問では点を持たず、
 * evaluated は設問の類型表の類型を必ず持つ（ほかの判定は類型を持たない）
 */
export function assertQuestioningScores(
  scores: readonly Pick<
    QuestioningScoreInput,
    "status" | "partialScore" | "scaleLevelId"
  >[],
  region: QuestioningScoreRegion
): void {
  const { points } = region
  const scoringMethod = toScoringMethod(region.scoringMethod)
  for (const score of scores) {
    if (!isScoringStatus(score.status)) {
      throw new Error(`採点の判定「${String(score.status)}」は使えません`)
    }
    if (!isStatusCompatibleWithScoringMethod(scoringMethod, score.status)) {
      throw new Error(
        scoringMethod === "scale"
          ? "類型方式の設問には、正答・誤答・部分点を付けられません"
          : "類型方式でない設問には、類型を付けられません"
      )
    }
    if (score.status === "evaluated") {
      if (
        score.scaleLevelId === null ||
        !region.scaleLevelIds.includes(score.scaleLevelId)
      ) {
        throw new Error("この設問の類型表の類型ではありません")
      }
    } else if (score.scaleLevelId !== null) {
      throw new Error("類型を付けるときのほかは、類型を持ちません")
    }
    if (score.partialScore === null) continue
    if (scoringMethod === "scale") {
      throw new Error(
        "類型方式の設問では点を付けません（点は類型の点数から読みます）"
      )
    }
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
  /** 類型方式の設問で付ける類型（evaluated のときだけ）。それ以外は null */
  scaleLevelId: string | null
}

/**
 * 問いかけで教員が直接決めた点を、操作者自身の採点として書く（採点キーと同じ書き方。
 * 行が無ければ作る。適用のあるマスでは手での上書きになる）。1件ずつ順に書く。
 * 類型を付ける点（evaluated）は、類型ごとにまとめて類型の書き込み（`setScaleLevels`）で書く
 */
export async function writeAiQuestioningScores(
  input: { cropRegionId: string; scores: AiQuestioningScoreWrite[] },
  actorUserId: string
): Promise<number> {
  const cropRegion = await prisma.cropRegion.findUnique({
    where: { id: input.cropRegionId },
    include: questioningRegionInclude,
  })
  if (!cropRegion) throw new Error("設問が見つかりません")
  assertQuestioningScores(input.scores, toQuestioningScoreRegion(cropRegion))
  const examStudentIdsByScaleLevelId = new Map<string, string[]>()
  for (const score of input.scores) {
    if (score.status === "evaluated" && score.scaleLevelId !== null) {
      const examStudentIds =
        examStudentIdsByScaleLevelId.get(score.scaleLevelId) ?? []
      examStudentIds.push(score.examStudentId)
      examStudentIdsByScaleLevelId.set(score.scaleLevelId, examStudentIds)
      continue
    }
    await setQuestionScore({
      examStudentId: score.examStudentId,
      cropRegionId: input.cropRegionId,
      userId: actorUserId,
      status: score.status,
      partialScore: score.partialScore,
    })
  }
  for (const [scaleLevelId, examStudentIds] of examStudentIdsByScaleLevelId) {
    await setScaleLevels(
      { cropRegionId: input.cropRegionId, examStudentIds, scaleLevelId },
      actorUserId
    )
  }
  return input.scores.length
}

/**
 * 答え（下書き）を確定済みにする。教員の層へ書き終えた答えだけを渡す（自分で採点した案の答えと、
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
