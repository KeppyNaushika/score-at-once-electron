/**
 * AI が返した JSON を記録する前に検証するための、1段目・2段目で共有する規則
 * （docs/vlm-grading-design.md §6）
 *
 * 構造化出力に対応した事業者でも、範囲（0〜配点）・刻み（0.01）・項目どうしの関係は
 * スキーマで縛れない（`gradingSchema.ts`）。`json_object` で受ける接続先では形そのものも
 * 保証されない。したがって、形とアプリの規則の両方を各段の検証
 * （`stage1ResponseValidator.ts`・`stage2ResponseValidator.ts`）で確かめる。ここはその共通部分:
 *
 * - status は correct / partial / incorrect / no_answer / pending のいずれか
 * - partialScore は partial では必ずあり、pending では任意（点の無い保留）。それ以外では無い。
 *   あるときは 0〜配点に収まる
 * - 0.01 より細かい点は 0.01 単位に丸めて受け取り、丸めたことを notes に残す
 * - 満点の partial は correct に寄せる（部分点が満点なら正答と同じ）
 * - 文字列の字数の上限
 */

import { isOneOf } from "@/types/stringUnion"

import {
  AI_GRADING_OUTPUT_STATUSES,
  AI_GRADING_SCORED_STATUSES,
  type AiGradingOutputStatus,
} from "./gradingSchema"

/** 浮動小数の誤差（0.1 + 0.2 など）を、0.01 より細かい点と取り違えないための許容幅 */
const CENT_EPSILON = 1e-9

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const isAiGradingOutputStatus = (
  value: unknown
): value is AiGradingOutputStatus =>
  typeof value === "string" && isOneOf(AI_GRADING_OUTPUT_STATUSES, value)

const isScoredStatus = (status: AiGradingOutputStatus): boolean =>
  isOneOf(AI_GRADING_SCORED_STATUSES, status)

const roundToCent = (score: number): number => Math.round(score * 100) / 100

const hasFinerThanCent = (score: number): boolean =>
  Math.abs(score * 100 - Math.round(score * 100)) > CENT_EPSILON

/**
 * 字数の上限を確かめて文字列を読む（1段目・2段目の検証が使う）。
 * 字数はコードポイントで数える。`label` は理由に出す項目の名前（入れ子なら `proposals[0].label` など）
 */
export function readBoundedString(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
  reasons: string[],
  label = key
): string {
  const field = record[key]
  if (typeof field !== "string") {
    reasons.push(`${label} が文字列ではありません`)
    return ""
  }
  const length = [...field].length
  if (length > maxLength) {
    reasons.push(`${label} が${maxLength}字を超えています（${length}字）`)
  }
  return field
}

interface StatusScoreRuleInput {
  readonly status: AiGradingOutputStatus
  /** 形の検査を通った点（数でなかったときは null） */
  readonly partialScore: number | null
  /**
   * 応答の partialScore が null と書かれていたか。項目が無い・数でないときは形の検査が
   * 理由を足しているので、ここでは null と明示されたときだけ「点が無い」理由を足す
   */
  readonly partialScoreIsExplicitNull: boolean
  readonly maxPoints: number | null
  readonly reasons: string[]
  readonly notes: string[]
}

/**
 * 判定と点の関係の規則（設計 §6-1）を当て、受け取る判定と点を返す。2段目の選択肢の点にも使う。
 *
 * - partialScore は partial では必ずあり、pending では任意。それ以外では無い
 * - あるときは 0〜配点。0.01 より細かい点は丸めて notes に残す
 * - 満点の partial は correct に寄せる
 */
export function applyStatusScoreRules(input: StatusScoreRuleInput): {
  status: AiGradingOutputStatus
  partialScore: number | null
} {
  const { maxPoints, reasons, notes } = input
  let status = input.status
  let partialScore = input.partialScore

  if (isScoredStatus(status)) {
    if (partialScore === null) {
      // pending は点の無い保留を許す（仮の点を決められないことがある）
      if (status === "partial" && input.partialScoreIsExplicitNull) {
        reasons.push(`${status} なのに partialScore が null です`)
      }
    } else if (maxPoints === null) {
      reasons.push(`配点の無い設問に ${status} の点は付けられません`)
    } else {
      if (hasFinerThanCent(partialScore)) {
        const rounded = roundToCent(partialScore)
        notes.push(
          `partialScore を 0.01 単位に丸めました: ${partialScore} → ${rounded}`
        )
        partialScore = rounded
      }
      if (partialScore < 0 || partialScore > maxPoints) {
        reasons.push(
          `partialScore が 0〜${maxPoints} の範囲にありません: ${partialScore}`
        )
      } else if (status === "partial" && partialScore === maxPoints) {
        notes.push(`満点の partial を correct にしました（${partialScore}点）`)
        status = "correct"
        partialScore = null
      }
    }
  } else if (partialScore !== null) {
    reasons.push(
      `${status} には partialScore を付けられません: ${partialScore}`
    )
  }
  return { status, partialScore }
}
