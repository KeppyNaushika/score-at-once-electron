/**
 * 類型評価の設問の正答率と学習アドバイスのテスト（docs/vlm-grading-design.md §4-8-5）
 *
 * - calculateQuestionCorrectRates: 類型評価の設問は正答率を載せない（キーが無い）
 * - generateLearningAdvice（main）・calculateLearningAdvice（renderer）: 類型評価の設問は
 *   正答率で選ぶ復習の候補に入れない
 */
import { describe, expect, it } from "vitest"

import { calculateLearningAdvice } from "@/components/exams/09-export/utils/learningAdviceCalculator"
import { generateLearningAdvice } from "@/electron-src/lib/export/individual-report/adviceGenerator"
import { calculateQuestionCorrectRates } from "@/electron-src/lib/export/individual-report/statisticsCalculator"
import type { ScoreDetail, ScoringData } from "@/electron-src/lib/shared/types"
import type { AdviceOptions } from "@/types/individualReport.types"

function pointsScore(
  questionId: string,
  status: ScoreDetail["status"],
  score: number | null
): ScoreDetail {
  return {
    questionId,
    questionLabel: questionId,
    score,
    maxScore: 10,
    status,
    scoringMethod: "points",
    scaleLevel: null,
  }
}

function scaleScore(
  questionId: string,
  scaleLevel: ScoreDetail["scaleLevel"]
): ScoreDetail {
  return {
    questionId,
    questionLabel: questionId,
    score: scaleLevel?.score ?? null,
    maxScore: 10,
    status: scaleLevel === null ? "unscored" : "evaluated",
    scoringMethod: "scale",
    scaleLevel,
  }
}

function scoringData(studentId: string, scores: ScoreDetail[]): ScoringData {
  return {
    examStudentId: `exam-${studentId}`,
    studentId,
    studentName: studentId,
    studentNumber: studentId,
    scores,
    totalScore: null,
    totalMaxScore: 20,
    subtotalScores: [],
  }
}

const NO_LIMIT: AdviceOptions = {
  reviewRateMin: null,
  reviewRateMax: null,
  reviewQuestionCount: null,
}

describe("calculateQuestionCorrectRates", () => {
  it("類型評価の設問は正答率を載せず、点の採点の設問は今までどおり数える", () => {
    const rates = calculateQuestionCorrectRates([
      scoringData("student-1", [
        pointsScore("points-question", "correct", 10),
        scaleScore("scale-question", { id: "level-a", label: "A", score: 10 }),
      ]),
      scoringData("student-2", [
        pointsScore("points-question", "incorrect", 0),
        scaleScore("scale-question", { id: "level-b", label: "B", score: 6 }),
      ]),
    ])

    expect(rates).toEqual({ "points-question": 50 })
  })
})

describe("学習アドバイスの復習の候補", () => {
  // 生徒は点の設問を間違え、類型評価の設問で B を付けられた
  const scores = [
    pointsScore("points-question", "incorrect", 0),
    scaleScore("scale-question", { id: "level-b", label: "B", score: 6 }),
    scaleScore("unevaluated-scale-question", null),
  ]
  const questionCorrectRates = { "points-question": 80 }

  it("main（generateLearningAdvice）は類型評価の設問を候補に入れない", () => {
    const advice = generateLearningAdvice(
      scores,
      questionCorrectRates,
      NO_LIMIT
    )
    expect(
      advice.reviewQuestions.map((question) => question.questionId)
    ).toEqual(["points-question"])
  })

  it("renderer（calculateLearningAdvice）も類型評価の設問を候補に入れない", () => {
    const advice = calculateLearningAdvice(
      scores,
      questionCorrectRates,
      NO_LIMIT
    )
    expect(
      advice.reviewQuestions.map((question) => question.questionId)
    ).toEqual(["points-question"])
  })
})
