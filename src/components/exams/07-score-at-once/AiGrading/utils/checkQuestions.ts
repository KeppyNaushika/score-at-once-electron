/**
 * AI 採点チェックの問い（docs/vlm-grading-design.md §3-10）を、チェックの実行の試行と
 * 教員の今の採点から手元で組み立てる（AI は呼ばない。教員の点は AI に送っていない）。
 *
 * 1. 同じ答えに違う点: 1段目の書き起こしを正規化して（全角半角・空白の揺れを除く）同じなのに、
 *    教員の点が違う答案の組
 * 2. 先生と AI の食い違い: 1 に入らない答案のうち、教員の判定と AI の判定が違うもの（AI の確信度の高い順）
 */

import { toAiGradingConfidence } from "@/types/aiGrading.types"

import type { AiGradingRunRow } from "../types"
import {
  decisionFromAttemptResponses,
  KEEP_OPTION_KEY,
  latestAttemptResponse,
} from "./attemptResponseDecision"
import {
  describeScore,
  isSameQuestioningScore,
  type QuestioningOption,
  type QuestioningScore,
  type QuestioningStep,
  type QuestioningStepState,
} from "./questioningSteps"

type CheckAttempt = AiGradingRunRow["attempts"][number]

/** 書き起こしを比べる形へ（全角半角を揃え、空白を除く） */
export function normalizeTranscription(transcription: string): string {
  return transcription.normalize("NFKC").replace(/\s+/g, "")
}

const scoreKeyOf = (score: QuestioningScore) =>
  `${score.status}:${score.partialScore ?? ""}`

const aiScoreOf = (attempt: CheckAttempt): QuestioningScore => ({
  status: attempt.status,
  partialScore: attempt.partialScore,
})

const CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 } as const

interface BuildCheckQuestioningInput {
  /** 問いに使う採点チェックの実行（最後に終わったもの）。無ければ問いは無い */
  checkRun: Pick<AiGradingRunRow, "attempts"> | null
  /** 教員の今の採点（未採点なら null） */
  ownScoreOf: (examStudentId: string) => QuestioningScore | null
  points: number | null
}

/** 「このままにする」の選択肢 */
const keepOption = (description: string): QuestioningOption => ({
  key: KEEP_OPTION_KEY,
  label: "このままにする",
  description,
  recommended: false,
  score: null,
  writesScore: false,
})

/** 直す選択肢 */
const rescoreOption = (
  score: QuestioningScore,
  label: string,
  description: string,
  recommended: boolean
): QuestioningOption => ({
  key: `rescore:${scoreKeyOf(score)}`,
  label,
  description,
  recommended,
  score,
  writesScore: true,
})

/** 採点チェックの問いを、問いかける順に、いまの答え付きで */
export function buildCheckQuestioning({
  checkRun,
  ownScoreOf,
  points,
}: BuildCheckQuestioningInput): QuestioningStepState[] {
  if (!checkRun) return []
  const seenExamStudentIds = new Set<string>()
  const attempts = checkRun.attempts.filter((attempt) => {
    if (attempt.state !== "succeeded") return false
    if (ownScoreOf(attempt.examStudentId) === null) return false
    if (seenExamStudentIds.has(attempt.examStudentId)) return false
    seenExamStudentIds.add(attempt.examStudentId)
    return true
  })
  const steps: QuestioningStep[] = []
  const groupedAttemptIds = new Set<string>()

  // 1. 同じ答えに違う点
  const groups = new Map<string, CheckAttempt[]>()
  attempts.forEach((attempt) => {
    const normalized = normalizeTranscription(attempt.transcription)
    if (normalized === "") return
    groups.set(normalized, [...(groups.get(normalized) ?? []), attempt])
  })
  groups.forEach((groupAttempts, normalized) => {
    const ownScores = groupAttempts.flatMap((attempt) => {
      const score = ownScoreOf(attempt.examStudentId)
      return score ? [score] : []
    })
    const distinct = new Map<
      string,
      { score: QuestioningScore; count: number }
    >()
    ownScores.forEach((score) => {
      const key = scoreKeyOf(score)
      distinct.set(key, {
        score,
        count: (distinct.get(key)?.count ?? 0) + 1,
      })
    })
    if (groupAttempts.length < 2 || distinct.size < 2) return
    groupAttempts.forEach((attempt) => groupedAttemptIds.add(attempt.id))

    // AI の多数の判定（推奨にする）
    const aiCounts = new Map<
      string,
      { score: QuestioningScore; count: number }
    >()
    groupAttempts.forEach((attempt) => {
      const score = aiScoreOf(attempt)
      const key = scoreKeyOf(score)
      aiCounts.set(key, { score, count: (aiCounts.get(key)?.count ?? 0) + 1 })
    })
    const aiMajority = [...aiCounts.values()].sort(
      (left, right) => right.count - left.count
    )[0]?.score
    const teacherChoices = [...distinct.values()].sort(
      (left, right) => right.count - left.count
    )
    const recommendedKey = aiMajority
      ? scoreKeyOf(aiMajority)
      : scoreKeyOf(teacherChoices[0].score)
    const options = teacherChoices.map(({ score, count }) =>
      rescoreOption(
        score,
        `すべて${describeScore(score, points)}`,
        aiMajority && isSameQuestioningScore(aiMajority, score)
          ? `いま${count}件がこの点。AI の判定も同じ`
          : `いま${count}件がこの点`,
        scoreKeyOf(score) === recommendedKey
      )
    )
    if (aiMajority && !distinct.has(scoreKeyOf(aiMajority))) {
      options.push(
        rescoreOption(
          aiMajority,
          `すべて${describeScore(aiMajority, points)}`,
          "AI の判定",
          true
        )
      )
    }
    options.push(keepOption("点を変えない"))
    const shownText = groupAttempts[0].transcription.trim() || normalized
    steps.push({
      id: `same:${normalized}`,
      kind: "sameAnswer",
      title: `同じ答え「${shownText}」に、違う点が付いています`,
      question:
        distinct.size > 2 ? "どれに揃えますか？" : "どちらに揃えますか？",
      detail: "",
      members: groupAttempts.map((attempt) => ({
        examStudentId: attempt.examStudentId,
        attemptId: attempt.id,
      })),
      options,
      allowsManual: true,
      allowsInstruction: false,
    })
  })

  // 2. 先生と AI の食い違い（AI の確信度の高い順。同じ確信度は答案の並び順）
  attempts
    .filter((attempt) => !groupedAttemptIds.has(attempt.id))
    .filter((attempt) => {
      const ownScore = ownScoreOf(attempt.examStudentId)
      return (
        ownScore !== null &&
        !isSameQuestioningScore(ownScore, aiScoreOf(attempt))
      )
    })
    .sort(
      (left, right) =>
        CONFIDENCE_RANK[toAiGradingConfidence(left.confidence)] -
        CONFIDENCE_RANK[toAiGradingConfidence(right.confidence)]
    )
    .forEach((attempt) => {
      const ownScore = ownScoreOf(attempt.examStudentId)
      if (!ownScore) return
      const aiScore = aiScoreOf(attempt)
      const finding = attempt.observation.trim() || attempt.transcription.trim()
      steps.push({
        id: `diff:${attempt.id}`,
        kind: "disagreement",
        title: `あなたは${describeScore(ownScore, points)}、AI は${describeScore(aiScore, points)}と判定しました`,
        question: finding
          ? `AI は「${finding}」と見ています。`
          : "AI の所見はありません。",
        detail: "",
        members: [
          { examStudentId: attempt.examStudentId, attemptId: attempt.id },
        ],
        options: [
          rescoreOption(
            aiScore,
            `${describeScore(aiScore, points)} に直す`,
            "AI の判定",
            true
          ),
          keepOption(`${describeScore(ownScore, points)}のまま`),
        ],
        allowsManual: true,
        allowsInstruction: false,
      })
    })

  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]))
  return steps.map((step) => {
    const read = decisionFromAttemptResponses(step, (attemptId) => {
      const attempt = attemptById.get(attemptId)
      return attempt ? latestAttemptResponse(attempt) : undefined
    })
    return { step, ...read, draftProposalResponseId: null }
  })
}
