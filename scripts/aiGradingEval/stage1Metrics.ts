/**
 * 1段目の指標（docs/vlm-grading-design.md §12）。純粋な関数で、記録の並びから求める。
 *
 * - 形の守り具合: CLI が結果を返した件数のうち、検証を通った割合
 * - 判定の一致率・点の一致率・±1点以内の率: 比べる相手が決まったマス（確定・合意）だけ
 * - 確信度別の判定の一致率
 * - 割れたマス: どちらかの採点者と判定が一致した割合
 * - 所見の長さと、所見に判定・点の話が混ざった件数（所見は答案の事実だけを書かせる）
 * - 費用（定価換算の目安）と時間
 */

import { calculateActualScore } from "../../electron-src/lib/shared/calculations/actualScore"

import type { ClaudeCliUsage } from "./claudeCli"
import type { ReferenceScore, ReferenceVerdict } from "./referenceScore"

/** 1段目の判定の検証の結果（評価に要る分だけ） */
export type Stage1EvalVerdict =
  | {
      ok: true
      status: "correct" | "partial" | "incorrect" | "no_answer" | "pending"
      partialScore: number | null
      confidence: "high" | "medium" | "low"
      transcription: string
      observation: string
    }
  | { ok: false; reasons: readonly string[] }

/** マス1つの評価の記録 */
export interface Stage1EvalRecord {
  cropRegionId: string
  examStudentId: string
  label: string
  points: number | null
  cliOk: boolean
  errorText: string
  verdict: Stage1EvalVerdict | null
  reference: ReferenceScore
  usage: ClaudeCliUsage
  costUsd: number
  wallMs: number
}

interface RateCount {
  n: number
  matched: number
}

export interface Stage1Metrics {
  total: number
  cliFailures: number
  shapeOkRate: number | null
  compared: number
  statusMatchRate: number | null
  scoreMatchRate: number | null
  withinOneRate: number | null
  byConfidence: Record<"high" | "medium" | "low", RateCount>
  disputed: RateCount
  /** 比べる相手の判定 → AI の判定 の件数 */
  confusion: Record<string, Record<string, number>>
  totalCostUsd: number
  meanWallMs: number | null
  p90WallMs: number | null
  meanInputTokens: number | null
  meanOutputTokens: number | null
  meanObservationLength: number | null
  /** 所見に判定の結論や点の話（「誤答とした」「部分点」など）が混ざった件数 */
  observationVerdictMentions: number
}

/** 所見に混ざると困る、判定の結論や点の言い回し */
const VERDICT_MENTION_PATTERN =
  /(とした|とする|部分点|減点|誤答|正答|保留|満点|\d+点)/

const rate = (count: RateCount): number | null =>
  count.n === 0 ? null : count.matched / count.n

const mean = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((acc, current) => acc + current, 0) / values.length

function percentile(
  values: readonly number[],
  fraction: number
): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ]
}

/** AI の判定の実際の点（pending で点が無ければ null） */
function aiScore(
  verdict: Extract<Stage1EvalVerdict, { ok: true }>,
  points: number | null
) {
  return points === null
    ? null
    : calculateActualScore(
        { status: verdict.status, partialScore: verdict.partialScore },
        points
      )
}

const sameStatus = (verdict: { status: string }, reference: ReferenceVerdict) =>
  verdict.status === reference.status

/** 記録の並びから指標を求める */
export function computeStage1Metrics(
  records: readonly Stage1EvalRecord[]
): Stage1Metrics {
  const cliSucceeded = records.filter((record) => record.cliOk)
  const validated = cliSucceeded.flatMap((record) =>
    record.verdict?.ok ? [{ record, verdict: record.verdict }] : []
  )
  const statusCount: RateCount = { n: 0, matched: 0 }
  const scoreCount: RateCount = { n: 0, matched: 0 }
  const withinOneCount: RateCount = { n: 0, matched: 0 }
  const disputed: RateCount = { n: 0, matched: 0 }
  const byConfidence = {
    high: { n: 0, matched: 0 },
    medium: { n: 0, matched: 0 },
    low: { n: 0, matched: 0 },
  }
  const confusion: Record<string, Record<string, number>> = {}

  validated.forEach(({ record, verdict }) => {
    const { reference } = record
    if (reference.kind === "none") return
    if (reference.kind === "disputed") {
      disputed.n += 1
      if (
        reference.candidates.some((candidate) => sameStatus(verdict, candidate))
      ) {
        disputed.matched += 1
      }
      return
    }
    const isStatusMatch = sameStatus(verdict, reference.verdict)
    statusCount.n += 1
    byConfidence[verdict.confidence].n += 1
    if (isStatusMatch) {
      statusCount.matched += 1
      byConfidence[verdict.confidence].matched += 1
    }
    const row = (confusion[reference.verdict.status] ??= {})
    row[verdict.status] = (row[verdict.status] ?? 0) + 1

    const score = aiScore(verdict, record.points)
    if (reference.verdict.score !== null) {
      scoreCount.n += 1
      withinOneCount.n += 1
      if (score !== null && score === reference.verdict.score)
        scoreCount.matched += 1
      if (score !== null && Math.abs(score - reference.verdict.score) <= 1) {
        withinOneCount.matched += 1
      }
    }
  })

  const wallTimes = cliSucceeded.map((record) => record.wallMs)
  return {
    total: records.length,
    cliFailures: records.length - cliSucceeded.length,
    shapeOkRate:
      cliSucceeded.length === 0 ? null : validated.length / cliSucceeded.length,
    compared: statusCount.n,
    statusMatchRate: rate(statusCount),
    scoreMatchRate: rate(scoreCount),
    withinOneRate: rate(withinOneCount),
    byConfidence,
    disputed,
    confusion,
    totalCostUsd: records.reduce((acc, record) => acc + record.costUsd, 0),
    meanWallMs: mean(wallTimes),
    p90WallMs: percentile(wallTimes, 0.9),
    meanInputTokens: mean(
      cliSucceeded.map(
        (record) =>
          record.usage.inputTokens +
          record.usage.cacheReadTokens +
          record.usage.cacheWriteTokens
      )
    ),
    meanOutputTokens: mean(
      cliSucceeded.map((record) => record.usage.outputTokens)
    ),
    meanObservationLength: mean(
      validated.map(({ verdict }) => [...verdict.observation].length)
    ),
    observationVerdictMentions: validated.filter(({ verdict }) =>
      VERDICT_MENTION_PATTERN.test(verdict.observation)
    ).length,
  }
}
