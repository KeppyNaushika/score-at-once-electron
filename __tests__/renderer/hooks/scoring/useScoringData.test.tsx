// @vitest-environment jsdom
/**
 * 採点画面（07）が採点行をどこから読むか。
 *
 * 段階70 で、採点行を設問ごとの束として渡す形にした（採点領域の木から外した）。
 * ここで固定するのは**このフックの出力**なので、渡し方が変わってもこの網は生き残る。
 *
 * 07 が出すのは**自分の採点だけ**。他の教員の採点も同じ束で届いているが、画面には
 * 出さない（食い違いを裁くのは採点する場ではない）。
 */

import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useScoringData } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringData"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"

import { createQueryWrapper } from "../../../helpers/queryWrapper"

const EXAM_ID = "exam-1"
const EXAM_PAGE_ID = "page-1"
const CROP_REGION_ID = "region-1"
const EXAM_STUDENT_A = "es-a"
const EXAM_STUDENT_B = "es-b"
const SELF_USER_ID = "user-self"
const OTHER_USER_ID = "user-other"

interface QuestionScoreSeed {
  id: string
  examStudentId: string
  status: string
  userId: string
  updatedAt?: string
}

const CROP_REGIONS = [
  {
    id: CROP_REGION_ID,
    examPageId: EXAM_PAGE_ID,
    label: "問1",
    points: 5,
  },
] as unknown as QuestionAnswerRegionRow[]

function buildQuestionScores(
  questionScoreSeeds: QuestionScoreSeed[]
): Map<string, QuestionScoreRow[]> {
  return new Map([
    [
      CROP_REGION_ID,
      questionScoreSeeds.map((seed) => ({
        ...seed,
        cropRegionId: CROP_REGION_ID,
        partialScore: null,
        updatedAt: seed.updatedAt ?? "2026-08-18T00:00:00.000Z",
      })) as unknown as QuestionScoreRow[],
    ],
  ])
}

/** 受験者2人ぶんの答案が1ページに載っている */
const STUDENT_ANSWER_IMAGES = [
  { examPageId: EXAM_PAGE_ID, examStudentId: EXAM_STUDENT_A },
  { examPageId: EXAM_PAGE_ID, examStudentId: EXAM_STUDENT_B },
] as unknown as StudentAnswerImageWithExamStudents[]

function renderScoringData(
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]>
) {
  return renderHook(
    () =>
      useScoringData({
        examId: EXAM_ID,
        currentUserId: SELF_USER_ID,
        currentCropRegionId: CROP_REGION_ID,
        studentAnswerImages: STUDENT_ANSWER_IMAGES,
        cropRegions: CROP_REGIONS,
        questionScoresByCropRegionId,
      }),
    { wrapper: createQueryWrapper() }
  )
}

describe("useScoringData の進捗", () => {
  it("渡された束だけで数える（採点行を自分で取りに行かない）", () => {
    const { result } = renderScoringData(
      buildQuestionScores([
        {
          id: "qs-a",
          examStudentId: EXAM_STUDENT_A,
          status: "correct",
          userId: SELF_USER_ID,
        },
      ])
    )

    const progress = result.current.calculateQuestionProgress()[CROP_REGION_ID]

    expect(progress.totalAnswers).toBe(2)
    expect(progress.gradedAnswers).toBe(1)
  })

  it("他の教員の採点は混ざらない", () => {
    const { result } = renderScoringData(
      buildQuestionScores([
        {
          id: "qs-a",
          examStudentId: EXAM_STUDENT_A,
          status: "correct",
          userId: SELF_USER_ID,
        },
        {
          id: "qs-b",
          examStudentId: EXAM_STUDENT_B,
          status: "correct",
          userId: OTHER_USER_ID,
        },
      ])
    )

    const progress = result.current.calculateQuestionProgress()[CROP_REGION_ID]

    // 他の教員が B を採点済みでも、自分から見た進捗は 1/2 のまま
    expect(progress.gradedAnswers).toBe(1)
    expect(progress.percentage).toBe(50)
  })

  it("同じマスに自分の行が2つあっても、最後に書かれた行で数える", () => {
    const { result } = renderScoringData(
      buildQuestionScores([
        {
          id: "qs-old",
          examStudentId: EXAM_STUDENT_A,
          status: "unscored",
          userId: SELF_USER_ID,
          updatedAt: "2026-08-17T00:00:00.000Z",
        },
        {
          id: "qs-new",
          examStudentId: EXAM_STUDENT_A,
          status: "correct",
          userId: SELF_USER_ID,
          updatedAt: "2026-08-18T00:00:00.000Z",
        },
      ])
    )

    const progress = result.current.calculateQuestionProgress()[CROP_REGION_ID]

    expect(progress.gradedAnswers).toBe(1)
  })
})
