/**
 * 案の外の問いかけ（採点チェックの問い・どの案にも入らない答案）への教員の答え
 * （AiAttemptResponse）の書き込み（docs/vlm-grading-design.md §3-5・§3-10）。
 *
 * 問いは届いた試行と教員の採点から画面が毎回組み立てるので、答えは答案（試行）ごとに持つ。
 * 1つの問いの答えは、その問いの答案すべてに同じ種類の行を書く。答え直しは新しい行（答案ごとに
 * 最新が効く）。**書くのは AI の層だけ**で、教員の採点は確定のとき（`writeAiQuestioningScores`）に書く。
 *
 * 読み出しは実行の一覧（`listAiGradingRunsByCropRegion`）が試行に同梱する。
 */

import { isAiAttemptResponseChoice } from "@/types/aiGrading.types"
import { isScoringStatus } from "@/types/scoringStatus.types"

import {
  assertQuestioningScores,
  toPartialScoreColumn,
} from "./aiQuestioningScore"
import prisma from "./client"

/** 答案1件への答え */
export interface AiAttemptResponseInput {
  attemptId: string
  /** "rescore"（この判定に直す）| "keep"（このままにする）| "manual"（1件ずつ自分で採点する） */
  choice: string
  /** rescore・manual で付ける判定。keep と、manual で付けていない答案は null */
  status: string | null
  partialScore: number | null
}

/**
 * 案の外の問いかけに答える（下書き）。答えられるのは、その試行の実行の教員だけ。
 * 1回の呼び出し（1つの問いの答え）は1つのトランザクションで書く
 */
export async function recordAiAttemptResponses(
  input: { responses: AiAttemptResponseInput[] },
  actorUserId: string
) {
  const attemptIds = [
    ...new Set(input.responses.map((response) => response.attemptId)),
  ]
  const attempts = await prisma.aiGradingAttempt.findMany({
    where: { id: { in: attemptIds } },
    include: {
      run: { include: { prompt: { include: { cropRegion: true } } } },
    },
  })
  if (attempts.length !== attemptIds.length) {
    throw new Error("答えた答案の AI の判定が見つかりません")
  }
  if (attempts.some((attempt) => attempt.run.userId !== actorUserId)) {
    throw new Error("問いかけに答えられるのは、AI 採点を実行した教員だけです")
  }
  const pointsByAttemptId = new Map(
    attempts.map((attempt) => [
      attempt.id,
      attempt.run.prompt.cropRegion.points,
    ])
  )
  for (const response of input.responses) {
    if (!isAiAttemptResponseChoice(response.choice)) {
      throw new Error(`答えの種類「${response.choice}」は使えません`)
    }
    if (response.choice === "keep" && response.status !== null) {
      throw new Error("「このままにする」の答えは点を持ちません")
    }
    if (response.choice === "rescore" && response.status === null) {
      throw new Error("直す答えには判定が要ります")
    }
    if (response.status === null) {
      if (response.partialScore !== null) {
        throw new Error("判定の無い答えは点を持ちません")
      }
      continue
    }
    if (!isScoringStatus(response.status)) {
      throw new Error(`採点の判定「${response.status}」は使えません`)
    }
    assertQuestioningScores(
      [{ status: response.status, partialScore: response.partialScore }],
      pointsByAttemptId.get(response.attemptId) ?? null
    )
  }

  return prisma.$transaction(
    input.responses.map((response) =>
      prisma.aiAttemptResponse.create({
        data: {
          attemptId: response.attemptId,
          choice: response.choice,
          status: response.status,
          partialScore: toPartialScoreColumn(response.partialScore),
        },
      })
    )
  )
}
