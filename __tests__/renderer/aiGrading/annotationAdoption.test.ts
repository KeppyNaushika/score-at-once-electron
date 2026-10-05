/**
 * 朱書きだけをまとめて反映するときの対象（採点の確定とは別）。
 *
 * ここで固定すること:
 * - AI の判定の状態で、朱書きを入れる答案を選べる（既定は部分点だけ）
 * - 朱書きの文が無い答案・その試行の朱書きを反映済みの答案・判定が出ていない答案は対象外
 * - 点を採用したかどうかは関係しない（採点済みの答案も対象になる）
 */

import { describe, expect, it } from "vitest"

import {
  DEFAULT_ANNOTATION_TARGET_STATUSES,
  selectAnnotationAdoptionTargets,
} from "@/components/exams/07-score-at-once/AiGrading/utils/annotationAdoption"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"

import {
  makeAnswer,
  makeAttemptWithRun,
  makeQuestionScore,
} from "./helpers/aiGradingRowFixtures"

function answerWith(
  examStudentId: string,
  attemptOverrides: Parameters<typeof makeAttemptWithRun>[0],
  questionScore = undefined as ReturnType<typeof makeQuestionScore> | undefined
) {
  const answer = makeAnswer(examStudentId, {
    attempts: [makeAttemptWithRun({ ...attemptOverrides, examStudentId })],
    questionScore,
  })
  return {
    answer,
    review: reviewAnswer(answer, {
      chosenAttemptIdByExamStudentId: new Map(),
      selectedPromptId: "prompt-1",
      points: 4,
    }),
  }
}

const idsOf = (reviewedAnswers: ReturnType<typeof answerWith>[]) =>
  reviewedAnswers.map(
    (reviewedAnswer) => reviewedAnswer.answer.attempts[0]?.attempt.examStudentId
  )

describe("selectAnnotationAdoptionTargets", () => {
  const partial = answerWith("partial", {
    examStudentId: "partial",
    status: "partial",
    partialScore: 2,
    annotationText: "根拠が足りません",
  })
  const correct = answerWith("correct", {
    examStudentId: "correct",
    status: "correct",
    annotationText: "よくできています",
  })
  const incorrect = answerWith("incorrect", {
    examStudentId: "incorrect",
    status: "incorrect",
    annotationText: "符号が逆です",
  })

  it("既定は部分点の答案だけ", () => {
    expect(
      idsOf(
        selectAnnotationAdoptionTargets(
          [partial, correct, incorrect],
          DEFAULT_ANNOTATION_TARGET_STATUSES
        )
      )
    ).toEqual(["partial"])
  })

  it("選んだ状態の答案に入れる（誤答には入れない、など）", () => {
    expect(
      idsOf(
        selectAnnotationAdoptionTargets(
          [partial, correct, incorrect],
          new Set(["partial", "correct"])
        )
      )
    ).toEqual(["partial", "correct"])
  })

  it("朱書きが無い・反映済み・判定が出ていない答案は対象外", () => {
    const empty = answerWith("empty", {
      examStudentId: "empty",
      status: "partial",
      annotationText: "  ",
    })
    const alreadyAdopted = answerWith("adopted", {
      examStudentId: "adopted",
      status: "partial",
      annotationText: "反映済み",
      adoptedDrawingAnnotationId: "drawing-1",
    })
    const errored = answerWith("errored", {
      examStudentId: "errored",
      state: "errored",
      status: "partial",
      annotationText: "失敗",
    })
    expect(
      selectAnnotationAdoptionTargets(
        [empty, alreadyAdopted, errored],
        new Set(["partial"])
      )
    ).toEqual([])
  })

  it("自分が採点済みの答案も対象になる（点とは別に確定する）", () => {
    const scored = answerWith(
      "scored",
      {
        examStudentId: "scored",
        status: "partial",
        annotationText: "根拠が足りません",
      },
      makeQuestionScore({ examStudentId: "scored" })
    )
    expect(
      idsOf(selectAnnotationAdoptionTargets([scored], new Set(["partial"])))
    ).toEqual(["scored"])
  })
})
