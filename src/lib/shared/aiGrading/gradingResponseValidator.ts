/**
 * VLM が返した採点の JSON を、記録する前に検証する（docs/vlm-grading-design.md §5）
 *
 * 構造化出力に対応した事業者でも、範囲（0〜配点）・刻み（0.01）・項目どうしの関係は
 * スキーマで縛れない（`gradingSchema.ts`）。`json_object` で受ける接続先では形そのものも
 * 保証されない。したがって、形とアプリの規則の両方をここで確かめる。
 *
 * - 形: `buildGradingOutputSchema()` の6項目がそろい、余分な項目が無く、型が合う
 * - status は correct / partial / incorrect / no_answer / pending のいずれか
 * - partialScore は partial と pending のときだけあり、0〜配点に収まる
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isStatus = (value: unknown): value is AiGradingOutputStatus =>
  typeof value === "string" && isOneOf(AI_GRADING_OUTPUT_STATUSES, value)

const isScoredStatus = (status: AiGradingOutputStatus): boolean =>
  isOneOf(AI_GRADING_SCORED_STATUSES, status)

const roundToCent = (score: number): number => Math.round(score * 100) / 100

const hasFinerThanCent = (score: number): boolean =>
  Math.abs(score * 100 - Math.round(score * 100)) > CENT_EPSILON

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

  if (!isStatus(shape.status)) {
    reasons.push(
      `status が ${AI_GRADING_OUTPUT_STATUSES.join(" / ")} のいずれでもありません: ${String(shape.status)}`
    )
    return { ok: false, reasons }
  }
  let status: AiGradingOutputStatus = shape.status
  let partialScore = shape.partialScore

  if (isScoredStatus(status)) {
    const { maxPoints } = context
    if (partialScore === null) {
      // 項目が無い・数でないときは形の検査が理由を足している
      if (response.partialScore === null) {
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

  if (reasons.length > 0) return { ok: false, reasons }
  return {
    ok: true,
    value: { ...shape, status, partialScore },
    notes,
  }
}
