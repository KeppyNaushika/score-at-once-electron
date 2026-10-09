/**
 * AI の判定と比べる「教員の採点」を、マスごとに1つに決める。
 *
 * 1マスに複数の採点者がいることがあるので、集計・出力のリゾルバ
 * （`electron-src/lib/shared/calculations/scoreResolution.ts`）と同じ順で決める:
 *
 * 1. 確定（ScoreDecision）があればそれ
 * 2. unscored 以外の採点が1つならそれ、複数でも判定と点が全員一致すればそれ
 * 3. 食い違っていれば「割れたマス」。一致率の分母から外し、どちらかの採点者と
 *    一致したかを別に数える（教員の間でも割れる答案で、AI の正誤を決められないため）
 * 4. 採点が無ければ比べない
 *
 * リゾルバそのものを使わないのは、割れたマスの候補（各採点者の判定）が要るため。
 */

import { calculateActualScore } from "../../electron-src/lib/shared/calculations/actualScore"
import {
  isScoringStatus,
  type ScoringStatus,
} from "../../src/types/scoringStatus.types"

import type { EvalCell } from "./devData"

/** 比べる相手の採点1つ */
export interface ReferenceVerdict {
  status: ScoringStatus
  /** 実際の点（判定と部分点から。未採点などは null） */
  score: number | null
}

export type ReferenceScore =
  | { kind: "decided" | "agreed"; verdict: ReferenceVerdict }
  | { kind: "disputed"; candidates: ReferenceVerdict[] }
  | { kind: "none" }

function toVerdict(
  status: string,
  partialScore: number | null,
  maxPoints: number | null
): ReferenceVerdict | null {
  if (!isScoringStatus(status)) return null
  return {
    status,
    score:
      maxPoints === null
        ? null
        : calculateActualScore({ status, partialScore }, maxPoints),
  }
}

/** マスの比べる相手を決める */
export function resolveReferenceScore(
  cell: Pick<EvalCell, "teacherScores" | "decision">,
  maxPoints: number | null
): ReferenceScore {
  if (cell.decision) {
    const verdict = toVerdict(
      cell.decision.status,
      cell.decision.score,
      maxPoints
    )
    if (verdict) return { kind: "decided", verdict }
  }
  const candidates = cell.teacherScores
    .filter((teacherScore) => teacherScore.status !== "unscored")
    .flatMap((teacherScore) => {
      const verdict = toVerdict(
        teacherScore.status,
        teacherScore.partialScore,
        maxPoints
      )
      return verdict ? [verdict] : []
    })
  if (candidates.length === 0) return { kind: "none" }
  const [first] = candidates
  const allAgree = candidates.every(
    (candidate) =>
      candidate.status === first.status && candidate.score === first.score
  )
  return allAgree
    ? { kind: "agreed", verdict: first }
    : { kind: "disputed", candidates }
}
