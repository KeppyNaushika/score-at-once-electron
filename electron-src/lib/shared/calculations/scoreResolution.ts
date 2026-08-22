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
 * **入力は「シリアライズ後の行」で受ける**（`SerializedQuestionScore` /
 * `SerializedScoreDecision`）。Decimal→number と判定の絞り込みは行を作る側
 * （`toSerializedQuestionScore` / `toSerializedScoreDecision`）で1回だけ済ませ、
 * ここでは行の全列が揃っている前提に立つ。かつては `id` と `updatedAt` を省略可能に
 * していたため、渡し忘れた行が最新判定（`pickLatest`）で常に負け、その採点者の点数が
 * 黙って採用されないという穴があった。
 *
 * 解決ルール（決定的）:
 * 1. ScoreDecision があればそれを採用（確定後に新しい提案があれば isStale を立てる）
 * 2. 提案のうち unscored 以外が1つならそれを採用
 * 3. unscored 以外の提案が複数でも、判定と点数が全行一致していれば合意として採用
 *    （参加採点者が1人の試験では常にここで解決される = 個人利用と同一挙動）
 * 4. 一致しなければ競合 — 値を出さず conflicts に記録する
 *
 * unscored 行は他の行が存在する場合は無視する。**`unscored` は採点の意思表示ではない**
 * からで、掃き残しへの応急処置ではない。注釈（DrawingAnnotation）は親の採点行を必須で
 * 持つので、「注釈だけ付けて採点はまだ」を表すには `unscored` の行が要る。行は在るが
 * 提案ではない、という状態はこれからも正しく起こる。
 */

import type {
  SerializedQuestionScore,
  SerializedScoreDecision,
} from "@/types/prismaExtensions"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { calculateActualScore } from "./actualScore"

/** 受験者×設問ごとに解決された有効スコア */
export interface EffectiveScore {
  examStudentId: string
  cropRegionId: string
  /** 採点判定 */
  status: ScoringStatus
  partialScore: number | null
  /**
   * このセルで描画注釈を印刷する QuestionScore 行の id。
   *
   * 提案から解決したセルは採用した1行だけ。確定（decision）したセルはそのセルの
   * 全行になる — 確定は「結果」を決める操作で、誰の採点を採ったかは記録していない
   * （同じ結果を出した採点者が複数いれば、どれを採ったかは決まらない）ので、
   * どの注釈を印刷するかも絞れない。当面すべて表示する。
   */
  annotationQuestionScoreIds: string[]
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

/** updatedAt 降順 → id 降順の決定的な「最新」選択 */
const pickLatest = (
  group: SerializedQuestionScore[]
): SerializedQuestionScore =>
  group.reduce((latest, current) => {
    const latestTime = latest.updatedAt.getTime()
    const currentTime = current.updatedAt.getTime()
    if (currentTime !== latestTime)
      return currentTime > latestTime ? current : latest
    return current.id > latest.id ? current : latest
  })

const cellKey = (examStudentId: string, cropRegionId: string): string =>
  `${examStudentId} ${cropRegionId}`

const proposalToEffective = (
  proposal: SerializedQuestionScore,
  isStale = false
): EffectiveScore => ({
  examStudentId: proposal.examStudentId,
  cropRegionId: proposal.cropRegionId,
  status: proposal.status,
  partialScore: proposal.partialScore,
  annotationQuestionScoreIds: [proposal.id],
  source: "proposal",
  isStale,
})

export function resolveEffectiveScores(
  scores: SerializedQuestionScore[],
  decisions: SerializedScoreDecision[] = []
): ResolveResult {
  const groups = new Map<string, SerializedQuestionScore[]>()
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
    const decidedAt = decision.decidedAt.getTime()
    const isStale = proposals.some(
      (proposal) =>
        proposal.status !== "unscored" &&
        proposal.updatedAt.getTime() > decidedAt
    )

    resolved.push({
      examStudentId: decision.examStudentId,
      cropRegionId: decision.cropRegionId,
      status: decision.verdict,
      partialScore: decision.score,
      annotationQuestionScoreIds: proposals.map((proposal) => proposal.id),
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
        proposal.partialScore === first.partialScore
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
