// @vitest-environment jsdom
/**
 * 07 が方式と合わない採点（類型評価の設問の正答・誤答・部分点、点の採点の設問の評価済み）を
 * 未採点として読むこと（docs/vlm-grading-design.md §4-8-8）。
 *
 * 行は DB に残すだけで、マスの状態・点・AI採点の「自分の採点」のどれにも出さない。
 * 方式を戻したときにだけ、元の採点として表に出る。
 *
 * 実データは使わない。
 */

import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { findOwnQuestionScore } from "@/components/exams/07-score-at-once/AiGrading/utils/scoreComparison"
import { selectGradingTargets } from "@/components/exams/07-score-at-once/AiGrading/utils/selectGradingTargets"
import { useQuestionScoringData } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useQuestionScoringData"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makeQuestionScore,
  makeStudentAnswerImage,
} from "../aiGrading/helpers/aiGradingRowFixtures"

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")
const EXAM_STUDENT_ID = "exam-student-1"
const NO_WHITENESS = new Map()

function makeCropRegion(scoringMethod: string): QuestionAnswerRegionRow {
  return {
    id: CROP_REGION_ID,
    examPageId: EXAM_PAGE_ID,
    label: "1-(1)",
    type: "QUESTION_ANSWER",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    height: 0.2,
    points: 10,
    orderIndex: 0,
    scoringMethod,
    scoreScaleId: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    examPage: {
      id: EXAM_PAGE_ID,
      examId: "exam-1",
      pageNumber: 1,
      imagePath: "master/page1.png",
      pageSize: "A4",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
    cropSubtotals: [],
  }
}

/** 設問1つ・答案1枚の一覧のマス（自分の採点行を1つ置く） */
function scoringDataOf(scoringMethod: string, questionScore: QuestionScoreRow) {
  const { result } = renderHook(() =>
    useQuestionScoringData({
      currentCropRegion: makeCropRegion(scoringMethod),
      studentAnswerImages: [makeStudentAnswerImage(EXAM_STUDENT_ID)],
      questionScoresByCropRegionId: new Map([
        [CROP_REGION_ID, [questionScore]],
      ]),
      currentUserId: CURRENT_USER_ID,
      exam: null,
      gradingMode: "grid",
      answerSortOrder: "custom",
      whitenessByAnswerId: NO_WHITENESS,
    })
  )
  const [scoringData] = result.current.allScoringData
  return scoringData
}

describe("一覧のマスの状態", () => {
  it("類型評価の設問の部分点は、未採点として点も持たない", () => {
    const scoringData = scoringDataOf(
      "scale",
      makeQuestionScore({
        examStudentId: EXAM_STUDENT_ID,
        status: "partial",
        partialScore: 4,
      })
    )

    expect(scoringData.status).toBe("unscored")
    expect(scoringData.currentScore).toBeUndefined()
  })

  it("点の採点の設問の評価済みは未採点として読む", () => {
    const scoringData = scoringDataOf(
      "points",
      makeQuestionScore({
        examStudentId: EXAM_STUDENT_ID,
        status: "evaluated",
        partialScore: 6,
      })
    )

    expect(scoringData.status).toBe("unscored")
    expect(scoringData.currentScore).toBeUndefined()
  })

  it("方式を戻せば元の採点として出る", () => {
    const scoringData = scoringDataOf(
      "points",
      makeQuestionScore({
        examStudentId: EXAM_STUDENT_ID,
        status: "partial",
        partialScore: 4,
      })
    )

    expect(scoringData.status).toBe("partial")
    expect(scoringData.currentScore).toBe(4)
  })
})

describe("AI採点の自分の採点", () => {
  const evaluatedRow = makeQuestionScore({
    examStudentId: EXAM_STUDENT_ID,
    status: "evaluated",
  })

  it("方式と合わない自分の採点は、無いものとして読む", () => {
    expect(
      findOwnQuestionScore(
        [evaluatedRow],
        { id: CROP_REGION_ID, scoringMethod: "points" },
        EXAM_STUDENT_ID,
        CURRENT_USER_ID
      )
    ).toBeUndefined()
    expect(
      findOwnQuestionScore(
        [evaluatedRow],
        { id: CROP_REGION_ID, scoringMethod: "scale" },
        EXAM_STUDENT_ID,
        CURRENT_USER_ID
      )
    ).toBe(evaluatedRow)
  })

  it("方式と合わない自分の採点の答案は、未採点として送る対象に入る", () => {
    expect(
      selectGradingTargets(
        {
          cropRegion: { id: CROP_REGION_ID, scoringMethod: "points" },
          currentUserId: CURRENT_USER_ID,
          answers: [makeAnswer(EXAM_STUDENT_ID)],
          questionScores: [evaluatedRow],
          selectedExamStudentIds: new Set(),
        },
        "unscored"
      )
    ).toEqual([EXAM_STUDENT_ID])
  })
})
