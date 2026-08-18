// @vitest-environment jsdom
/**
 * 採点画面（07）が採点行をどこから読むか。
 *
 * 段階13 で「`QuestionScore` を根に取り直す」のをやめ、採点領域（`CropRegion`）の
 * 子として届いている行を読む形にした。ここで固定するのは**このフックの出力**なので、
 * 内部が平らな配列から木へ変わっても、この網は生き残る。
 *
 * 07 が出すのは**自分の採点だけ**。他の教員の採点も木には届いているが、画面には
 * 出さない（食い違いを裁くのは採点する場ではない）。
 */

import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useScoringData } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringData"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

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

function buildCropRegions(
  questionScoreSeeds: QuestionScoreSeed[]
): QuestionAnswerRegionRow[] {
  return [
    {
      id: CROP_REGION_ID,
      examPageId: EXAM_PAGE_ID,
      label: "問1",
      points: 5,
      questionScores: questionScoreSeeds.map((seed) => ({
        ...seed,
        cropRegionId: CROP_REGION_ID,
        partialScore: null,
        updatedAt: seed.updatedAt ?? "2026-08-18T00:00:00.000Z",
      })),
    },
  ] as unknown as QuestionAnswerRegionRow[]
}

/** 受験者2人ぶんの答案が1ページに載っている */
const STUDENT_ANSWER_IMAGES = [
  { examPageId: EXAM_PAGE_ID, examStudentId: EXAM_STUDENT_A },
  { examPageId: EXAM_PAGE_ID, examStudentId: EXAM_STUDENT_B },
] as unknown as StudentAnswerImageWithExamStudents[]

function renderScoringData(cropRegions: QuestionAnswerRegionRow[]) {
  return renderHook(
    () =>
      useScoringData({
        examId: EXAM_ID,
        currentUserId: SELF_USER_ID,
        currentCropRegionId: CROP_REGION_ID,
        studentAnswerImages: STUDENT_ANSWER_IMAGES,
        cropRegions,
      }),
    { wrapper: createQueryWrapper() }
  )
}

describe("useScoringData の進捗", () => {
  it("採点領域に届いている行だけで数える（採点行を別に取りに行かない）", () => {
    const { result } = renderScoringData(
      buildCropRegions([
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
      buildCropRegions([
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
      buildCropRegions([
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
