/**
 * 設問ごとの採点進捗。設問ナビゲータの表示と、その合計である試験全体の進捗カードの
 * 両方がこの1本から出る。
 *
 * かつて試験全体の進捗は main 側の専用IPCが別実装で数えていて、欠席者の扱いが
 * renderer 側と食い違っていた。IPCを廃してこちらへ寄せたので、数え方をここで固定する。
 *
 * 採点行は**設問ごとの束**として渡す（段階70）。採点領域の木に縫い付けていた頃は、
 * 1マス採点するたびに全設問ぶんを取り直していた。
 */
import { describe, expect, it } from "vitest"

import { calculateQuestionProgress } from "@/components/exams/07-score-at-once/ScoringData/utils/progressCalculator"
import type { StudentAnswerImageWithExamStudents } from "@/components/exams/07-score-at-once/types"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { ScoringStatus } from "@/types/scoringStatus.types"

const EXAM_PAGE_ID = "page-1"
const CROP_REGION_ID = "region-1"
const EXAM_STUDENT_A = "es-a"
const SELF_USER_ID = "user-self"
const OTHER_USER_ID = "user-other"

interface QuestionScoreSeed {
  id?: string
  status: ScoringStatus
  partialScore: number | null
  userId?: string
  updatedAt?: string
}

/** 1ページ・1設問・答案1枚。その1マスに任意の採点行をぶら下げる */
function buildProgress(questionScoreSeeds: QuestionScoreSeed[]) {
  const cropRegions = [
    {
      id: CROP_REGION_ID,
      examPageId: EXAM_PAGE_ID,
      label: "問1",
    },
  ] as unknown as QuestionAnswerRegionRow[]

  const questionScoresByCropRegionId = new Map<string, QuestionScoreRow[]>([
    [
      CROP_REGION_ID,
      questionScoreSeeds.map((seed, index) => ({
        id: seed.id ?? `qs-${index}`,
        cropRegionId: CROP_REGION_ID,
        examStudentId: EXAM_STUDENT_A,
        status: seed.status,
        partialScore: seed.partialScore,
        userId: seed.userId ?? SELF_USER_ID,
        updatedAt: seed.updatedAt ?? "2026-08-18T00:00:00.000Z",
      })) as unknown as QuestionScoreRow[],
    ],
  ])

  const answerImages = [
    { examPageId: EXAM_PAGE_ID, examStudentId: EXAM_STUDENT_A },
  ] as unknown as StudentAnswerImageWithExamStudents[]

  return calculateQuestionProgress(
    cropRegions,
    questionScoresByCropRegionId,
    answerImages,
    SELF_USER_ID
  )[CROP_REGION_ID]
}

/** 1マスに1行だけ置く従来の形 */
function buildSingleProgress(
  status: ScoringStatus,
  partialScore: number | null
) {
  return buildProgress([{ status, partialScore }])
}

describe("calculateQuestionProgress の確定件数", () => {
  it("保留は採点済みだが確定には数えない", () => {
    const progress = buildSingleProgress("pending", 3)

    expect(progress.gradedAnswers).toBe(1)
    expect(progress.finalizedAnswers).toBe(0)
  })

  it("部分点は点数が入っていれば確定に数える", () => {
    const progress = buildSingleProgress("partial", 3)

    expect(progress.gradedAnswers).toBe(1)
    expect(progress.finalizedAnswers).toBe(1)
  })

  it("部分点でも点数未入力なら採点済みにも確定にも数えない", () => {
    const progress = buildSingleProgress("partial", null)

    expect(progress.gradedAnswers).toBe(0)
    expect(progress.finalizedAnswers).toBe(0)
  })

  it("正誤は無条件に確定へ数える", () => {
    const progress = buildSingleProgress("correct", null)

    expect(progress.gradedAnswers).toBe(1)
    expect(progress.finalizedAnswers).toBe(1)
  })

  it("未採点はどちらにも数えない", () => {
    const progress = buildSingleProgress("unscored", null)

    expect(progress.totalAnswers).toBe(1)
    expect(progress.gradedAnswers).toBe(0)
    expect(progress.finalizedAnswers).toBe(0)
  })

  it("確定件数は採点済み件数を超えない", () => {
    const progress = buildSingleProgress("correct", null)

    expect(progress.finalizedAnswers).toBeLessThanOrEqual(
      progress.gradedAnswers
    )
  })
})

describe("calculateQuestionProgress が数えるのは自分の採点だけ", () => {
  it("他の教員が採点していても、自分が採点していなければ未採点のまま", () => {
    const progress = buildProgress([
      { status: "correct", partialScore: null, userId: OTHER_USER_ID },
    ])

    expect(progress.totalAnswers).toBe(1)
    expect(progress.gradedAnswers).toBe(0)
  })

  it("自分と他の教員の採点が並んでいても、自分の判定で数える", () => {
    const progress = buildProgress([
      { status: "correct", partialScore: null, userId: OTHER_USER_ID },
      { status: "pending", partialScore: 3, userId: SELF_USER_ID },
    ])

    // 自分の判定は保留なので、採点済みではあるが確定ではない
    expect(progress.gradedAnswers).toBe(1)
    expect(progress.finalizedAnswers).toBe(0)
  })
})

describe("同じマスに同じ利用者の行が2つある（同期のマージ）", () => {
  it("先頭ではなく、最後に書かれた行で数える", () => {
    const progress = buildProgress([
      {
        id: "qs-old",
        status: "unscored",
        partialScore: null,
        updatedAt: "2026-08-17T00:00:00.000Z",
      },
      {
        id: "qs-new",
        status: "correct",
        partialScore: null,
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
    ])

    expect(progress.gradedAnswers).toBe(1)
    expect(progress.finalizedAnswers).toBe(1)
  })

  it("並び順が逆でも同じ結果になる", () => {
    const progress = buildProgress([
      {
        id: "qs-new",
        status: "correct",
        partialScore: null,
        updatedAt: "2026-08-18T00:00:00.000Z",
      },
      {
        id: "qs-old",
        status: "unscored",
        partialScore: null,
        updatedAt: "2026-08-17T00:00:00.000Z",
      },
    ])

    expect(progress.gradedAnswers).toBe(1)
  })

  it("更新時刻まで同じなら id の大きい方を採る（結果が並び順で揺れない）", () => {
    const sameMoment = "2026-08-18T00:00:00.000Z"
    const forward = buildProgress([
      {
        id: "qs-a",
        status: "unscored",
        partialScore: null,
        updatedAt: sameMoment,
      },
      {
        id: "qs-b",
        status: "correct",
        partialScore: null,
        updatedAt: sameMoment,
      },
    ])
    const backward = buildProgress([
      {
        id: "qs-b",
        status: "correct",
        partialScore: null,
        updatedAt: sameMoment,
      },
      {
        id: "qs-a",
        status: "unscored",
        partialScore: null,
        updatedAt: sameMoment,
      },
    ])

    expect(forward.gradedAnswers).toBe(1)
    expect(backward.gradedAnswers).toBe(1)
  })
})
