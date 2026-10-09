/**
 * 2段目（項目の案）の応答を、記録する前に検証する（docs/vlm-grading-design.md §6-2）
 *
 * - 送った答案の番号・送った項目の id だけを含む（知らないものは拒む）
 * - 案ごとに選択肢が 1〜上限個、推奨はちょうど1つ。選択肢の形は種類で決まる（§6-4）
 * - 点の範囲と刻みは1段目と同じ規則（`applyStatusScoreRules`）
 * - 字数に上限があり、助言の文案は改行の無い一文
 *
 * 判定が correct でない答案のうち、どの案にも入らず既存の項目にも当たらないものは
 * `uncoveredAnswerKeys` に返す（外れではなく「判断できない」として残す。§6-2）。
 */

import { isRecord, readBoundedString } from "./gradingResponseValidator"
import {
  buildStage2OutputSchema,
  STAGE2_ADVICE_MAX_LENGTH,
  STAGE2_DESCRIPTION_MAX_LENGTH,
  STAGE2_LABEL_MAX_LENGTH,
  STAGE2_NOTES_MAX_LENGTH,
  type Stage2AnswerInput,
  stage2AnswerKey,
} from "./stage2Grouping"
import {
  type ValidatedStage2Option,
  validateStage2Options,
} from "./stage2OptionValidator"

/** 検証を通った項目の案 */
export interface ValidatedStage2Proposal {
  readonly label: string
  readonly description: string
  readonly adviceDraft: string
  readonly matchedRubricItemId: string | null
  readonly memberAnswerKeys: readonly string[]
  readonly options: readonly ValidatedStage2Option[]
}

export type Stage2ResponseValidation =
  | {
      readonly ok: true
      readonly proposals: readonly ValidatedStage2Proposal[]
      readonly notes: string
      /** correct でないのに、どの案にも既存の項目にも入らなかった答案 */
      readonly uncoveredAnswerKeys: readonly string[]
      /** 受け取るときに直したこと（重なりの除去・丸めなど） */
      readonly adjustments: readonly string[]
    }
  | { readonly ok: false; readonly reasons: readonly string[] }

export interface Stage2ValidationContext {
  readonly maxPoints: number | null
  readonly rubricItemIds: readonly string[]
  /** 送った答案（この並びが仮の番号 A1, A2, … になる） */
  readonly answers: readonly Stage2AnswerInput[]
}

const PROPOSAL_KEYS: readonly string[] =
  buildStage2OutputSchema([]).properties?.proposals?.items?.required ?? []

/** 助言の文案が、改行の無い一文か（句点は文末の1つまで） */
function isSingleSentence(adviceDraft: string): boolean {
  if (/[\r\n]/.test(adviceDraft)) return false
  const sentenceEnds = adviceDraft.match(/[。！？!?]/g) ?? []
  if (sentenceEnds.length === 0) return true
  return sentenceEnds.length === 1 && /[。！？!?]$/.test(adviceDraft.trim())
}

interface ProposalContext extends Stage2ValidationContext {
  readonly answerKeys: readonly string[]
  readonly reasons: string[]
  readonly adjustments: string[]
}

/** 案1つを検証する。外れは reasons へ足し、形の読めた値を返す */
function validateProposal(
  proposal: unknown,
  proposalIndex: number,
  context: ProposalContext
): ValidatedStage2Proposal | null {
  const path = `proposals[${proposalIndex}]`
  const { reasons, adjustments } = context
  if (!isRecord(proposal)) {
    reasons.push(`${path} がオブジェクトではありません`)
    return null
  }
  const unknownKeys = Object.keys(proposal).filter(
    (key) => !PROPOSAL_KEYS.includes(key)
  )
  if (unknownKeys.length > 0) {
    reasons.push(`${path} に知らない項目があります: ${unknownKeys.join(", ")}`)
  }
  const label = readBoundedString(
    proposal,
    "label",
    STAGE2_LABEL_MAX_LENGTH,
    reasons,
    `${path}.label`
  )
  if (label.trim() === "") reasons.push(`${path}.label が空です`)
  const description = readBoundedString(
    proposal,
    "description",
    STAGE2_DESCRIPTION_MAX_LENGTH,
    reasons,
    `${path}.description`
  )
  const adviceDraft = readBoundedString(
    proposal,
    "adviceDraft",
    STAGE2_ADVICE_MAX_LENGTH,
    reasons,
    `${path}.adviceDraft`
  )
  if (!isSingleSentence(adviceDraft)) {
    reasons.push(`${path}.adviceDraft が一文ではありません`)
  }

  const { matchedRubricItemId } = proposal
  if (
    matchedRubricItemId !== null &&
    (typeof matchedRubricItemId !== "string" ||
      !context.rubricItemIds.includes(matchedRubricItemId))
  ) {
    reasons.push(
      `${path}.matchedRubricItemId が送った項目の id ではありません: ${String(matchedRubricItemId)}`
    )
  }

  const memberAnswerKeys: string[] = []
  const rawMembers = proposal.memberAnswerKeys
  if (!Array.isArray(rawMembers)) {
    reasons.push(`${path}.memberAnswerKeys が配列ではありません`)
  } else {
    rawMembers.forEach((answerKey) => {
      if (
        typeof answerKey !== "string" ||
        !context.answerKeys.includes(answerKey)
      ) {
        reasons.push(
          `${path} に送っていない答案の番号があります: ${String(answerKey)}`
        )
      } else if (memberAnswerKeys.includes(answerKey)) {
        adjustments.push(
          `${path} の重なった答案の番号を1つにまとめました: ${answerKey}`
        )
      } else {
        memberAnswerKeys.push(answerKey)
      }
    })
    if (rawMembers.length === 0)
      reasons.push(`${path} に当てはまる答案がありません`)
  }

  const options = validateStage2Options(proposal.options, {
    path,
    maxPoints: context.maxPoints,
    reasons,
    adjustments,
  })
  return {
    label,
    description,
    adviceDraft,
    matchedRubricItemId:
      typeof matchedRubricItemId === "string" ? matchedRubricItemId : null,
    memberAnswerKeys,
    options,
  }
}

/** 2段目の応答（パース済みの JSON）を検証する */
export function validateStage2Response(
  response: unknown,
  context: Stage2ValidationContext
): Stage2ResponseValidation {
  if (!isRecord(response)) {
    return { ok: false, reasons: ["応答が JSON のオブジェクトではありません"] }
  }
  const reasons: string[] = []
  const adjustments: string[] = []
  const unknownKeys = Object.keys(response).filter(
    (key) => key !== "proposals" && key !== "notes"
  )
  if (unknownKeys.length > 0) {
    reasons.push(`知らない項目があります: ${unknownKeys.join(", ")}`)
  }
  const notes = readBoundedString(
    response,
    "notes",
    STAGE2_NOTES_MAX_LENGTH,
    reasons
  )
  if (!Array.isArray(response.proposals)) {
    reasons.push("proposals が配列ではありません")
    return { ok: false, reasons }
  }

  const answerKeys = context.answers.map((_answer, answerIndex) =>
    stage2AnswerKey(answerIndex)
  )
  const proposalContext = { ...context, answerKeys, reasons, adjustments }
  const proposals = response.proposals.flatMap((proposal, proposalIndex) => {
    const validated = validateProposal(proposal, proposalIndex, proposalContext)
    return validated ? [validated] : []
  })
  if (reasons.length > 0) return { ok: false, reasons }

  const coveredKeys = new Set(
    proposals.flatMap((proposal) => proposal.memberAnswerKeys)
  )
  const uncoveredAnswerKeys = context.answers.flatMap((answer, answerIndex) => {
    const answerKey = answerKeys[answerIndex]
    const isCovered =
      answer.status === "correct" ||
      answer.matchedRubricItemIds.length > 0 ||
      coveredKeys.has(answerKey)
    return isCovered ? [] : [answerKey]
  })
  return { ok: true, proposals, notes, uncoveredAnswerKeys, adjustments }
}
