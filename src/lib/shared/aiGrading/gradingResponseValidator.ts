/**
 * VLM が返した採点の JSON を、記録する前に検証する（docs/vlm-grading-design.md §5）
 *
 * 構造化出力に対応した事業者でも、範囲（0〜配点）・刻み（0.01）・項目どうしの関係は
 * スキーマで縛れない（`gradingSchema.ts`）。`json_object` で受ける接続先では形そのものも
 * 保証されない。したがって、形とアプリの規則の両方をここで確かめる。
 *
 * - 形: `buildGradingOutputSchema()` の6項目がそろい、余分な項目が無く、型が合う
 * - status は correct / partial / incorrect / no_answer / pending のいずれか
 * - partialScore は partial では必ずあり、pending では任意（点の無い保留）。それ以外では無い。
 *   あるときは 0〜配点に収まる
 * - 0.01 より細かい点は 0.01 単位に丸めて受け取り、丸めたことを notes に残す
 * - 満点の partial は correct に寄せる（部分点が満点なら正答と同じ）
 *
 * 外れたものは `ok: false` と理由を返す。呼び出し側は試行の state を errored にして
 * 要確認に回す（理由は errorMessage へ）。
 */

import {
  type AiGradingConfidence,
  isAiGradingConfidence,
} from "@/types/aiGrading.types"
import { isOneOf } from "@/types/stringUnion"

import {
  AI_GRADING_OUTPUT_STATUSES,
  AI_GRADING_SCORED_STATUSES,
  type AiGradingOutputStatus,
  buildGradingOutputSchema,
} from "./gradingSchema"

/** 検証を通った判定。項目は `buildGradingOutputSchema()` と同じ */
export interface ValidatedGradingResponse {
  readonly transcription: string
  readonly status: AiGradingOutputStatus
  readonly partialScore: number | null
  readonly comment: string
  readonly annotation: string | null
  readonly confidence: AiGradingConfidence
}

export type GradingResponseValidation =
  | {
      readonly ok: true
      readonly value: ValidatedGradingResponse
      /** 受け取るときに直したこと（丸め・correct への寄せ）。画面と記録に残す */
      readonly notes: readonly string[]
    }
  | { readonly ok: false; readonly reasons: readonly string[] }

export interface GradingResponseValidationContext {
  /** 送ったときの配点（AiGradingRun.points）。配点の無い設問は null */
  readonly maxPoints: number | null
}

const OUTPUT_KEYS: readonly string[] = buildGradingOutputSchema().required ?? []

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
 * 判定と点の関係の規則（設計 §6-1）を当て、受け取る判定と点を返す。1段目の検証も使う。
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

/** 6項目の形と型だけを確かめる（規則は見ない）。外れた項目ごとに理由を足す */
function readShape(
  response: Record<string, unknown>,
  reasons: string[]
): Omit<ValidatedGradingResponse, "status"> & { status: unknown } {
  const missingKeys = OUTPUT_KEYS.filter((key) => !(key in response))
  if (missingKeys.length > 0) {
    reasons.push(`項目が足りません: ${missingKeys.join(", ")}`)
  }
  const unknownKeys = Object.keys(response).filter(
    (key) => !OUTPUT_KEYS.includes(key)
  )
  if (unknownKeys.length > 0) {
    reasons.push(`知らない項目があります: ${unknownKeys.join(", ")}`)
  }

  const readString = (key: string): string => {
    const field = response[key]
    if (typeof field === "string") return field
    if (key in response) reasons.push(`${key} が文字列ではありません`)
    return ""
  }

  const annotation = response.annotation
  if (
    "annotation" in response &&
    annotation !== null &&
    typeof annotation !== "string"
  ) {
    reasons.push("annotation が文字列でも null でもありません")
  }

  const partialScore = response.partialScore
  const isScoreNumber =
    typeof partialScore === "number" && Number.isFinite(partialScore)
  if ("partialScore" in response && partialScore !== null && !isScoreNumber) {
    reasons.push("partialScore が数でも null でもありません")
  }

  const confidence = response.confidence
  if ("confidence" in response && !isAiGradingConfidence(confidence)) {
    reasons.push(
      `confidence が high / medium / low のいずれでもありません: ${String(confidence)}`
    )
  }

  return {
    transcription: readString("transcription"),
    status: response.status,
    partialScore: isScoreNumber ? partialScore : null,
    comment: readString("comment"),
    annotation: typeof annotation === "string" ? annotation : null,
    confidence: isAiGradingConfidence(confidence) ? confidence : "low",
  }
}

/** VLM が返した JSON（パース済み）を検証する */
export function validateGradingResponse(
  response: unknown,
  context: GradingResponseValidationContext
): GradingResponseValidation {
  if (!isRecord(response)) {
    return { ok: false, reasons: ["応答が JSON のオブジェクトではありません"] }
  }

  const reasons: string[] = []
  const notes: string[] = []
  const shape = readShape(response, reasons)

  if (!isAiGradingOutputStatus(shape.status)) {
    reasons.push(
      `status が ${AI_GRADING_OUTPUT_STATUSES.join(" / ")} のいずれでもありません: ${String(shape.status)}`
    )
    return { ok: false, reasons }
  }
  const { status, partialScore } = applyStatusScoreRules({
    status: shape.status,
    partialScore: shape.partialScore,
    partialScoreIsExplicitNull: response.partialScore === null,
    maxPoints: context.maxPoints,
    reasons,
    notes,
  })

  if (reasons.length > 0) return { ok: false, reasons }
  return {
    ok: true,
    value: { ...shape, status, partialScore },
    notes,
  }
}
