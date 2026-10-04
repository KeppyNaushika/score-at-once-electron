/**
 * 設定違いの照合を並べる（docs/vlm-grading-design.md §3-3）。
 *
 * 自分の実行を（モデル・effort・拡大率）でまとめ、自分の採点との一致率と使用量を数える。
 * 新しい仕組みは要らない。run が設定を持っているので、画面の集計だけで済む。
 *
 * **採用した試行は数えない。** 採用すると自分の採点がその試行の写しになり、
 * 一致して当然のものが一致率を押し上げる。
 */

import type { QuestionScoreRow } from "@/queries/scoring"

import type { AiGradingRunRow } from "../types"
import { isAdoptedAttempt } from "./attemptSelection"
import {
  findOwnQuestionScore,
  isSameJudgement,
  isScored,
  isWithinOnePoint,
  judgementOfQuestionScore,
} from "./scoreComparison"

/** 設定の組1つぶんの集計 */
export interface SettingsAgreement {
  /** 組の識別（モデル・effort・拡大率をつないだもの） */
  settingsKey: string
  model: string
  effort: string
  imageScale: number
  runCount: number
  /** 判定が出た試行の数 */
  succeededCount: number
  /** 自分の採点と比べられた試行の数（自分が採点済み・採用していない） */
  comparedCount: number
  /** 判定と点がどちらも同じだった数 */
  exactMatchCount: number
  /** 点の差が1点以内だった数 */
  withinOnePointCount: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface SettingsAgreementInput {
  runs: readonly AiGradingRunRow[]
  questionScores: readonly QuestionScoreRow[]
  cropRegionId: string
  currentUserId: string
  points: number | null
}

/** 設定の組ごとに、一致率と使用量をまとめる（組は最初に現れた順） */
export function aggregateSettingsAgreement({
  runs,
  questionScores,
  cropRegionId,
  currentUserId,
  points,
}: SettingsAgreementInput): SettingsAgreement[] {
  const agreementBySettingsKey = new Map<string, SettingsAgreement>()

  for (const run of runs) {
    if (run.purpose !== "grade" || run.userId !== currentUserId) continue
    const settingsKey = [run.model, run.effort, run.imageScale].join("|")
    const agreement = agreementBySettingsKey.get(settingsKey) ?? {
      settingsKey,
      model: run.model,
      effort: run.effort,
      imageScale: run.imageScale,
      runCount: 0,
      succeededCount: 0,
      comparedCount: 0,
      exactMatchCount: 0,
      withinOnePointCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    }
    agreement.runCount += 1

    for (const attempt of run.attempts) {
      agreement.inputTokens += attempt.inputTokens
      agreement.outputTokens += attempt.outputTokens
      agreement.cacheReadTokens += attempt.cacheReadTokens
      agreement.cacheWriteTokens += attempt.cacheWriteTokens
      if (attempt.state !== "succeeded") continue
      agreement.succeededCount += 1
      if (isAdoptedAttempt({ attempt, run })) continue

      const questionScore = findOwnQuestionScore(
        questionScores,
        cropRegionId,
        attempt.examStudentId,
        currentUserId
      )
      if (!questionScore || !isScored(questionScore)) continue
      const teacherJudgement = judgementOfQuestionScore(questionScore)
      agreement.comparedCount += 1
      if (isSameJudgement(attempt, teacherJudgement, points)) {
        agreement.exactMatchCount += 1
      }
      if (isWithinOnePoint(attempt, teacherJudgement, points)) {
        agreement.withinOnePointCount += 1
      }
    }
    agreementBySettingsKey.set(settingsKey, agreement)
  }

  return [...agreementBySettingsKey.values()]
}
