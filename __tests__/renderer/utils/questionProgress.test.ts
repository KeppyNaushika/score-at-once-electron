/**
 * 設問ごとの採点進捗。設問ナビゲータの表示と、その合計である試験全体の進捗カードの
 * 両方がこの1本から出る。
 *
 * かつて試験全体の進捗は main 側の専用IPCが別実装で数えていて、欠席者の扱いが
 * renderer 側と食い違っていた。IPCを廃してこちらへ寄せたので、数え方をここで固定する。
 */
import { describe, expect, it } from "vitest"

import type {
  CropRegionWithExamPage,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/ScoringData/types"
import { calculateQuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/utils/progressCalculator"

const EXAM_PAGE_ID = "page-1"
const CROP_REGION_ID = "region-1"
const EXAM_STUDENT_A = "es-a"

/** 1ページ・1設問・答案1枚。その1マスに任意の採点状況を入れる */
function buildProgress(status: string, partialScore: number | null) {
  const cropRegions = [
    { id: CROP_REGION_ID, examPageId: EXAM_PAGE_ID, label: "問1" },
  ] as unknown as CropRegionWithExamPage[]

  const answerImages = [
    { examPageId: EXAM_PAGE_ID, examStudentId: EXAM_STUDENT_A },
  ] as unknown as StudentAnswerImageWithExamStudents[]

  const questionScores = [
    {
      cropRegionId: CROP_REGION_ID,
      examStudentId: EXAM_STUDENT_A,
      status,
      partialScore,
    },
  ]

  return calculateQuestionProgress(
    cropRegions,
    answerImages,
    // partialScore は IPC 越しに number 化済みのものが渡る
    questionScores as unknown as Parameters<typeof calculateQuestionProgress>[2]
  )[CROP_REGION_ID]
}

describe("calculateQuestionProgress の確定件数", () => {
  it("保留は採点済みだが確定には数えない", () => {
    const progress = buildProgress("pending", 3)

    expect(progress.gradedAnswers).toBe(1)
    expect(progress.finalizedAnswers).toBe(0)
  })

  it("部分点は点数が入っていれば確定に数える", () => {
    const progress = buildProgress("partial", 3)

    expect(progress.gradedAnswers).toBe(1)
    expect(progress.finalizedAnswers).toBe(1)
  })

  it("部分点でも点数未入力なら採点済みにも確定にも数えない", () => {
    const progress = buildProgress("partial", null)

    expect(progress.gradedAnswers).toBe(0)
    expect(progress.finalizedAnswers).toBe(0)
  })

  it("正誤は無条件に確定へ数える", () => {
    const progress = buildProgress("correct", null)

    expect(progress.gradedAnswers).toBe(1)
    expect(progress.finalizedAnswers).toBe(1)
  })

  it("未採点はどちらにも数えない", () => {
    const progress = buildProgress("unscored", null)

    expect(progress.totalAnswers).toBe(1)
    expect(progress.gradedAnswers).toBe(0)
    expect(progress.finalizedAnswers).toBe(0)
  })

  it("確定件数は採点済み件数を超えない", () => {
    const progress = buildProgress("correct", null)

    expect(progress.finalizedAnswers).toBeLessThanOrEqual(
      progress.gradedAnswers
    )
  })
})
