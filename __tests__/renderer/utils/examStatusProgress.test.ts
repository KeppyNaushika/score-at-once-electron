/**
 * 試験一覧の進捗計算が「受験者ID」で答案・採点を突き合わせることの固定。
 *
 * 採点層を ExamStudent 経由へ配線変更した際、main 側 `getExamsForList` の
 * `select` が examStudents の主キー（id）を落としたままだったため、
 * participatingExamStudentIds が [undefined, ...] になり、答案枚数も採点件数も
 * 常に 0 になっていた。IPC ハンドラは `(...args: any[]) => any` で型検査が効かず、
 * 一覧が「全試験が未着手」に見えるまで誰も気付けない。
 *
 * ここでは計算関数そのものに「受験者IDで突き合わせる」ことを固定し、
 * Student.id を渡すと 0 になることも併せて示す（取り違えの再発検知）。
 */
import { describe, expect, it } from "vitest"

import { getExamProgress } from "@/lib/examStatus"

const EXAM_STUDENT_A = "es-a"
const EXAM_STUDENT_B = "es-b"

/** 1ページ・1設問・受験者2名。答案は2枚、採点は1件だけ入っている */
function buildExam(examStudents: { id: string; status: string }[]) {
  return {
    examPages: [{ id: "page-1" }],
    answerImages: [
      { examStudentId: EXAM_STUDENT_A },
      { examStudentId: EXAM_STUDENT_B },
    ],
    cropRegions: [
      {
        type: "QUESTION_ANSWER",
        questionScores: [
          {
            examStudentId: EXAM_STUDENT_A,
            status: "correct",
            partialScore: null,
          },
        ],
      },
    ],
    examStudents,
    examSubtotalGroups: [],
  }
}

describe("getExamProgress の受験者スコープ", () => {
  it("受験者IDで答案・採点を突き合わせる", () => {
    const progress = getExamProgress(
      buildExam([
        { id: EXAM_STUDENT_A, status: "participating" },
        { id: EXAM_STUDENT_B, status: "participating" },
      ])
    )

    expect(progress.answerSheetCount).toBe(2)
    // 受験者2名 × 設問1 = 2 マスのうち 1 マスが採点済み
    expect(progress.expectedScoringCount).toBe(2)
    expect(progress.actualScoringCount).toBe(1)
  })

  it("欠席者は分母から外れる", () => {
    const progress = getExamProgress(
      buildExam([
        { id: EXAM_STUDENT_A, status: "participating" },
        { id: EXAM_STUDENT_B, status: "absent" },
      ])
    )

    expect(progress.answerSheetCount).toBe(1)
  })

  it("受験者IDでない値を渡すと何も突き合わない（取り違えの検知）", () => {
    const progress = getExamProgress(
      buildExam([
        { id: "student-a", status: "participating" },
        { id: "student-b", status: "participating" },
      ])
    )

    expect(progress.answerSheetCount).toBe(0)
    expect(progress.expectedScoringCount).toBe(0)
    expect(progress.actualScoringCount).toBe(0)
  })
})

/**
 * 進捗の分子と分母は同じ受験者集合で数える。
 */
describe("getExamProgress の受験者集合", () => {
  it("答案画像が無い生徒の採点は分子にも入らない", () => {
    const progress = getExamProgress({
      examPages: [{ id: "page-1" }],
      // 答案画像があるのは A のみ。B は採点行だけ存在する
      answerImages: [{ examStudentId: EXAM_STUDENT_A }],
      cropRegions: [
        {
          type: "QUESTION_ANSWER",
          questionScores: [
            {
              examStudentId: EXAM_STUDENT_A,
              status: "correct",
              partialScore: null,
            },
            {
              examStudentId: EXAM_STUDENT_B,
              status: "correct",
              partialScore: null,
            },
          ],
        },
      ],
      examStudents: [
        { id: EXAM_STUDENT_A, status: "participating" },
        { id: EXAM_STUDENT_B, status: "participating" },
      ],
      examSubtotalGroups: [],
    })

    expect(progress.expectedScoringCount).toBe(1)
    expect(progress.actualScoringCount).toBe(1)
    // 分子が分母を超えないこと（100%超の進捗の再発検知）
    expect(progress.actualScoringCount).toBeLessThanOrEqual(
      progress.expectedScoringCount
    )
  })
})
