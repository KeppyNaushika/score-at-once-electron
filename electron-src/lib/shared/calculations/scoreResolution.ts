/**
 * 有効スコアの解決（リゾルバ）
 *
 * 採点データは2層で保持される:
 * - QuestionScore: 採点者ごとの「提案」（受験者×設問×採点者）
 * - ScoreDecision: 試験OWNERによる「確定」（受験者×設問ごとに高々1行）
 *
 * 集計・出力系（Excel出力・個人レポート・PDF出力・小計・成績連携）は
 * 必ずこのモジュールで生徒×設問ごとに1つの有効スコアへ解決してから処理する。
 *
 * 解決ルール（決定的）:
 * 1. ScoreDecision があればそれを採用（確定後に新しい提案があれば isStale を立てる）
 * 2. 提案のうち unscored 以外が1つならそれを採用
 * 3. unscored 以外の提案が複数でも、判定と点数が全行一致していれば合意として採用
 *    （参加採点者が1人の試験では常にここで解決される = 個人利用と同一挙動）
 * 4. 一致しなければ競合 — 値を出さず conflicts に記録する
 *
 * unscored 行は他の行が存在する場合は無視する（scoringInitializer が
 * デフォルトユーザー名義で初期行を量産するため、採点の提案としては扱わない）。
 */

import {
  type ScoringStatus,
  toScoringStatus,
} from "@/types/scoringStatus.types"

import { calculateActualScore } from "./actualScore"

export interface ResolvableScore {
  examStudentId: string
  cropRegionId: string
  /** 採点判定の7値。`string` にすると得点化の網羅が効かなくなる */
  status: ScoringStatus
  partialScore: number | string | { toString(): string } | null
  id?: string
  updatedAt?: Date | string
}

/** 呼ぶ側が渡す形。Prisma の行そのまま（判定はまだ `string`） */
export type ResolvableScoreInput = Omit<ResolvableScore, "status"> & {
  status: string
}

/** 同上（確定の側） */
export type ResolvableDecisionInput = Omit<ResolvableDecision, "verdict"> & {
  verdict: string
}

/**
 * Prisma の行（`status` は `String` 列）を、判定を絞った形にする。**境界はここ1つ。**
 *
 * SQLite は enum を持てないので DB から出た時点では `string`。各所で `as` を書くと
 * 綴りの誤りも検査に掛からないので、変換を名前のある関数に集める。
 */
export const toResolvableScore = <T extends { status: string }>(
  row: T
): T & { status: ScoringStatus } => ({
  ...row,
  status: toScoringStatus(row.status),
})

export interface ResolvableDecision {
  examStudentId: string
  cropRegionId: string
  verdict: ScoringStatus
  score: number | string | { toString(): string } | null
  decidedAt?: Date | string
  sourceQuestionScoreId?: string | null
}

/** 受験者×設問ごとに解決された有効スコア */
export interface EffectiveScore {
  examStudentId: string
  cropRegionId: string
  /** 採点判定 */
  status: ScoringStatus
  partialScore: number | null
  /**
   * 採点マーク・描画注釈の参照に使う QuestionScore 行の id。
   * 確定（decision）で採用元提案が無い場合は null。
   */
  questionScoreId: string | null
  /** 由来: OWNER の確定か、提案（単独/合意）か */
  source: "decision" | "proposal"
  /** 確定より新しい提案が存在する（OWNER の再確認を推奨） */
  isStale: boolean
}

export interface ScoreConflict {
  examStudentId: string
  cropRegionId: string
  /** 競合した採点行の数（unscored を除く） */
  candidateCount: number
}

interface ResolveResult {
  /** 生徒×設問ごとに高々1件へ解決済みの有効スコア配列 */
  resolved: EffectiveScore[]
  /** 確定が無く、提案の値も食い違って解決できなかった生徒×設問の一覧 */
  conflicts: ScoreConflict[]
}

const normalizeScore = (
  value: ResolvableScore["partialScore"]
): number | null => {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

const toTime = (value: Date | string | undefined): number =>
  value ? new Date(value).getTime() : 0

/** updatedAt 降順 → id 降順の決定的な「最新」選択 */
const pickLatest = <T extends ResolvableScore>(group: T[]): T =>
  group.reduce((latest, current) => {
    const tLatest = toTime(latest.updatedAt)
    const tCurrent = toTime(current.updatedAt)
    if (tCurrent !== tLatest) return tCurrent > tLatest ? current : latest
    return (current.id ?? "") > (latest.id ?? "") ? current : latest
  })

const cellKey = (examStudentId: string, cropRegionId: string): string =>
  `${examStudentId} ${cropRegionId}`

const proposalToEffective = (
  proposal: ResolvableScore,
  isStale = false
): EffectiveScore => ({
  examStudentId: proposal.examStudentId,
  cropRegionId: proposal.cropRegionId,
  status: proposal.status,
  partialScore: normalizeScore(proposal.partialScore),
  questionScoreId: proposal.id ?? null,
  source: "proposal",
  isStale,
})

export function resolveEffectiveScores(
  rawScores: ResolvableScoreInput[],
  rawDecisions: ResolvableDecisionInput[] = []
): ResolveResult {
  // **判定を絞るのはここ1回。** 呼ぶ側は Prisma の行（`status` は String 列）を
  // そのまま渡してよい。各所で `as` を書くと、綴りの誤りも旧値の見落としも検査に
  // 掛からない（docs/branch-review-findings.md #16）
  const scores = rawScores.map(toResolvableScore)
  const decisions = rawDecisions.map((decision) => ({
    ...decision,
    verdict: toScoringStatus(decision.verdict),
  }))

  const groups = new Map<string, ResolvableScore[]>()
  for (const score of scores) {
    const key = cellKey(score.examStudentId, score.cropRegionId)
    const group = groups.get(key)
    if (group) {
      group.push(score)
    } else {
      groups.set(key, [score])
    }
  }

  const resolved: EffectiveScore[] = []
  const conflicts: ScoreConflict[] = []
  const decidedCells = new Set<string>()

  // 1) 明示的な確定（ScoreDecision）が最優先
  for (const decision of decisions) {
    const key = cellKey(decision.examStudentId, decision.cropRegionId)
    if (decidedCells.has(key)) continue // 不正データ耐性（uniqueにより通常は発生しない）
    decidedCells.add(key)

    const proposals = groups.get(key) ?? []
    const decidedAt = toTime(decision.decidedAt)
    const isStale = proposals.some(
      (proposal) =>
        proposal.status !== "unscored" && toTime(proposal.updatedAt) > decidedAt
    )

    resolved.push({
      examStudentId: decision.examStudentId,
      cropRegionId: decision.cropRegionId,
      status: decision.verdict,
      partialScore: normalizeScore(decision.score),
      questionScoreId: decision.sourceQuestionScoreId ?? null,
      source: "decision",
      isStale,
    })
  }

  // 2) 確定が無いセルは提案から導出
  for (const [key, group] of groups) {
    if (decidedCells.has(key)) continue

    const candidates = group.filter(
      (proposal) => proposal.status !== "unscored"
    )

    if (candidates.length === 0) {
      // 全行 unscored — 表示用に1件残す
      resolved.push(proposalToEffective(pickLatest(group)))
      continue
    }

    const first = candidates[0]
    const allAgree = candidates.every(
      (proposal) =>
        proposal.status === first.status &&
        normalizeScore(proposal.partialScore) ===
          normalizeScore(first.partialScore)
    )

    if (allAgree) {
      resolved.push(proposalToEffective(pickLatest(candidates)))
    } else {
      conflicts.push({
        examStudentId: first.examStudentId,
        cropRegionId: first.cropRegionId,
        candidateCount: candidates.length,
      })
    }
  }

  return { resolved, conflicts }
}

/**
 * 有効スコアの実際の得点を計算する。
 *
 * **`calculateActualScore` に委ねる。** かつては同じ規則を2箇所で書いており、
 * 一方は部分点として読む判定を、他方は `default: return 0` で0点にしていた。
 * 判定を union で受けるようにしたときに、その食い違いが表に出た
 * （docs/branch-review-findings.md #16）。
 */
export const calculateEffectiveScoreValue = (
  effective: Pick<EffectiveScore, "status" | "partialScore">,
  maxScore: number
): number | null => calculateActualScore(effective, maxScore)
