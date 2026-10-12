/**
 * 問いかけ（docs/vlm-grading-design.md §3-5・§3-10）の共通の形。
 *
 * AI 採点（2段目の項目の案）と AI チェック（同じ答えに違う点・先生と AI の食い違い）は、
 * どちらも「1問ずつのカード → 決めたことの記録 → 見直して確定」の同じ流れで出す。
 * 問い（`QuestioningStep`）は届いた行から画面が毎回組み立て、教員が決めたこと
 * （`QuestioningDecision`）は AI の層の答えの行から導く（列には持たない）。
 */

import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/** 答案に付ける点（判定と、部分点・保留の点） */
export interface QuestioningScore {
  status: ScoringStatus
  partialScore: number | null
}

/** 問いに入る答案1件 */
export interface QuestioningMember {
  examStudentId: string
  /** その答案への AI の判定（試行）の id */
  attemptId: string
}

/** 問いの選択肢1つ */
export interface QuestioningOption {
  /** 選択肢を見分ける値（案の選択肢なら選択肢の id） */
  key: string
  label: string
  /** 選択肢の下に添える一言 */
  description: string
  recommended: boolean
  /**
   * 確定で答案に直接書く点（AI チェックで直す点・判定を決める案の点）。点を変えない
   * （このままにする）・項目の計算で決まる（点を加減する案）なら null
   */
  score: QuestioningScore | null
  /** 確定で答案に点が付くか（件数に数える）。このままにする・採点方式は false */
  writesScore: boolean
}

/**
 * 問いの助言（AI 採点の案だけ。確定で項目の助言になり、朱書きになる）。"" は助言なし
 */
export interface QuestioningAdvice {
  /** 直していないときの文（当たる項目の助言。項目が無ければ AI の文案） */
  baseText: string
  /**
   * 当たる項目（既存の項目に当たる案はその項目、前に確定してできた・結び付けた項目があればそれ）。
   * 項目が無ければ null。答案の助言の朱書きのうち、この項目から作ったもの（`DrawingAnnotation.rubricItemId`）を
   * 下見で欄の文に差し替える
   */
  rubricItemId: string | null
  /** いま効いている文（下書きで直した文。直していなければ baseText） */
  text: string
}

/**
 * 問いの種類。scoringMethod は直接採点の設問で最初に聞く採点方式、proposal は2段目の項目の案、
 * outside はどの案にも入らない答案、sameAnswer は同じ答えに違う点、disagreement は先生と AI の食い違い
 */
type QuestioningStepKind =
  "scoringMethod" | "proposal" | "outside" | "sameAnswer" | "disagreement"

/** 問い1つ（カード1枚） */
export interface QuestioningStep {
  /** 画面の中で問いを見分ける値（行の id ではないものもある） */
  id: string
  kind: QuestioningStepKind
  /** 見出し（記録の1行にも使う） */
  title: string
  /** 選択肢の上に出す問い */
  question: string
  /** 問いに添える補足（案の説明・AI の所見）。無ければ "" */
  detail: string
  /** 助言（AI 採点の案だけ）。助言を持たない問いは null */
  advice: QuestioningAdvice | null
  members: QuestioningMember[]
  options: QuestioningOption[]
  /** 「自分で採点する」を出すか */
  allowsManual: boolean
  /** 「その他：再採点を指示する」を出すか（AI 採点の案だけ） */
  allowsInstruction: boolean
  /**
   * 「その他」の欄に書いてある文（AI 採点の案だけ。1打鍵ごとに書く行の、いちばん新しいもの）。
   * 書いていない・欄の無い問いは null
   */
  instructionDraft: string | null
}

/** 教員が決めたこと */
export type QuestioningDecision =
  | { kind: "option"; optionKey: string }
  /** 自分で採点した（受験者 → 付けた点。付けていない答案は入らない） */
  | { kind: "manual"; scores: ReadonlyMap<string, QuestioningScore> }
  /** 再採点への指示 */
  | { kind: "instruction"; text: string }

/**
 * 問いと、いま効いている答え。答えは下書き（`isCommitted: false`）か確定済み。
 * 下書きの行の id は、確定のときに確定済みにする印を付けるのに使う
 */
export interface QuestioningStepState {
  step: QuestioningStep
  decision: QuestioningDecision | null
  isCommitted: boolean
  /** 下書きの答えの行（案への答え）。無ければ null */
  draftProposalResponseId: string | null
  /** 下書きの答えの行（案の外の問いかけの、答案ごとの行） */
  draftAttemptResponseIds: string[]
}

/** 下書き（まだ確定していない答え）があるか */
export const hasDraft = (state: QuestioningStepState): boolean =>
  state.decision !== null && !state.isCommitted

/** 選択肢の位置の見つけ方（決めたことの選択肢） */
export function optionOfDecision(
  step: Pick<QuestioningStep, "options">,
  decision: QuestioningDecision | null
): QuestioningOption | null {
  if (decision?.kind !== "option") return null
  return (
    step.options.find((option) => option.key === decision.optionKey) ?? null
  )
}

/** 点を「正答 3点」「部分点 1点」「保留」のように（配点があれば点を添える） */
export function describeScore(
  score: QuestioningScore,
  points: number | null
): string {
  const label = SCORING_STATUS_LABELS[score.status]
  switch (score.status) {
    case "correct":
      return points === null ? label : `${label} ${points}点`
    case "incorrect":
    case "no_answer":
      return `${label} 0点`
    case "partial":
    case "pending":
      return score.partialScore === null
        ? label
        : `${label} ${score.partialScore}点`
    default:
      return label
  }
}

/** 2つの点が同じか（部分点は 0.01 単位で比べる） */
export function isSameQuestioningScore(
  left: QuestioningScore,
  right: QuestioningScore
): boolean {
  if (left.status !== right.status) return false
  const keepsScore = left.status === "partial" || left.status === "pending"
  if (!keepsScore) return true
  if (left.partialScore === null || right.partialScore === null) {
    return left.partialScore === right.partialScore
  }
  return (
    Math.round(left.partialScore * 100) === Math.round(right.partialScore * 100)
  )
}

/** 問いの一覧の行の札（決めたこと）。答案に点を付ける選択肢は、その判定の色で出す */
export interface QuestioningDecisionBadge {
  label: string
  /** 判定の色で出すときの判定。色を持たない札（自分で採点・再採点・このまま・採点方式）は null */
  status: ScoringStatus | null
}

/** 札に出す点（正答・誤答・無答は判定だけ。部分点・保留は点を添える） */
function badgeLabelOf(score: QuestioningScore): string {
  const label = SCORING_STATUS_LABELS[score.status]
  const keepsScore = score.status === "partial" || score.status === "pending"
  return keepsScore && score.partialScore !== null
    ? `${label} ${score.partialScore}点`
    : label
}

/** 決めたことの札 */
export function decisionBadgeOf(
  step: Pick<QuestioningStep, "options">,
  decision: QuestioningDecision
): QuestioningDecisionBadge {
  switch (decision.kind) {
    case "option": {
      const option = optionOfDecision(step, decision)
      if (!option) return { label: "選択肢が消えました", status: null }
      return option.score
        ? { label: badgeLabelOf(option.score), status: option.score.status }
        : { label: option.label, status: null }
    }
    case "manual":
      return {
        label:
          decision.scores.size > 0
            ? `自分で採点 ${decision.scores.size}件`
            : "自分で採点（未入力）",
        status: null,
      }
    case "instruction":
      return { label: "再採点を指示", status: null }
  }
}

/** 問いの見出しに添える件数（案・どの案にも入らない答案だけ）。添えないなら null */
export const memberCountLabelOf = (
  step: Pick<QuestioningStep, "kind" | "members">
): string | null =>
  step.kind === "proposal" || step.kind === "outside"
    ? `${step.members.length}件`
    : null

/** 2つの決めたことが同じか（同じなら答え直しの行を書かない） */
export function isSameDecision(
  left: QuestioningDecision | null,
  right: QuestioningDecision
): boolean {
  if (left === null || left.kind !== right.kind) return false
  if (left.kind === "option" && right.kind === "option") {
    return left.optionKey === right.optionKey
  }
  if (left.kind === "instruction" && right.kind === "instruction") {
    return left.text.trim() === right.text.trim()
  }
  if (left.kind === "manual" && right.kind === "manual") {
    if (left.scores.size !== right.scores.size) return false
    return [...right.scores].every(([examStudentId, score]) => {
      const leftScore = left.scores.get(examStudentId)
      return leftScore !== undefined && isSameQuestioningScore(leftScore, score)
    })
  }
  return false
}
