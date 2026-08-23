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

import { getExamProgress, getExamWorkflowStatus } from "@/lib/examStatus"

const EXAM_STUDENT_A = "es-a"
const EXAM_STUDENT_B = "es-b"
const SCORED_AT = new Date("2026-08-01T00:00:00.000Z")

/** 採点行1行（採点者ごとに1行）。更新時刻は確定の判定に使うので既定を置く */
function questionScore(overrides: {
  examStudentId: string
  status: string
  partialScore?: number | null
  updatedAt?: Date
}) {
  return {
    examStudentId: overrides.examStudentId,
    status: overrides.status,
    partialScore: overrides.partialScore ?? null,
    updatedAt: overrides.updatedAt ?? SCORED_AT,
  }
}

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
          questionScore({ examStudentId: EXAM_STUDENT_A, status: "correct" }),
        ],
        scoreDecisions: [],
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
            questionScore({
              examStudentId: EXAM_STUDENT_A,
              status: "correct",
            }),
            questionScore({
              examStudentId: EXAM_STUDENT_B,
              status: "correct",
            }),
          ],
          scoreDecisions: [],
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

/**
 * 「8. 採点確定」が済んだか。他の段と同じ1本の計算（getExamProgress）で言う。
 *
 * 裁定が要るのは**採点者どうしが食い違ったマス**だけ。単独採点では構造的に
 * 起きないので常に済みになり、梯子（getExamWorkflowStatus）がそこで止まらない
 * ——ここが崩れると、1人で使っている試験が一生「採点確定へ」を出し続ける。
 */
describe("getExamProgress の採点確定", () => {
  /** 1設問・受験者A のみ。そのマスに渡した提案と確定が入っている */
  function buildCell(
    proposals: ReturnType<typeof questionScore>[],
    scoreDecisions: { examStudentId: string; decidedAt: Date }[] = []
  ) {
    return getExamProgress({
      examPages: [{ id: "page-1" }],
      answerImages: [{ examStudentId: EXAM_STUDENT_A }],
      cropRegions: [
        {
          type: "QUESTION_ANSWER",
          questionScores: proposals,
          scoreDecisions,
        },
      ],
      examStudents: [{ id: EXAM_STUDENT_A, status: "participating" }],
      examSubtotalGroups: [],
    })
  }

  it("採点行が1つなら裁定は要らない（採点者1人はここに落ちる）", () => {
    const progress = buildCell([
      questionScore({ examStudentId: EXAM_STUDENT_A, status: "correct" }),
    ])

    expect(progress.pendingDecisionCount).toBe(0)
    expect(progress.hasFinalizedScores).toBe(true)
  })

  it("2人が同じ判定を入れただけなら合意（食い違いではない）", () => {
    const progress = buildCell([
      questionScore({
        examStudentId: EXAM_STUDENT_A,
        status: "partial",
        partialScore: 3,
      }),
      questionScore({
        examStudentId: EXAM_STUDENT_A,
        status: "partial",
        partialScore: 3,
      }),
    ])

    expect(progress.hasFinalizedScores).toBe(true)
  })

  it("2人の判定が割れたら裁定が要る", () => {
    const progress = buildCell([
      questionScore({
        examStudentId: EXAM_STUDENT_A,
        status: "correct",
      }),
      questionScore({
        examStudentId: EXAM_STUDENT_A,
        status: "incorrect",
      }),
    ])

    expect(progress.pendingDecisionCount).toBe(1)
    expect(progress.hasFinalizedScores).toBe(false)
  })

  it("部分点だけが違っても裁定が要る", () => {
    const progress = buildCell([
      questionScore({
        examStudentId: EXAM_STUDENT_A,
        status: "partial",
        partialScore: 2,
      }),
      questionScore({
        examStudentId: EXAM_STUDENT_A,
        status: "partial",
        partialScore: 3,
      }),
    ])

    expect(progress.hasFinalizedScores).toBe(false)
  })

  it("割れたマスに確定が入れば済み", () => {
    const progress = buildCell(
      [
        questionScore({
          examStudentId: EXAM_STUDENT_A,
          status: "correct",
        }),
        questionScore({
          examStudentId: EXAM_STUDENT_A,
          status: "incorrect",
        }),
      ],
      [
        {
          examStudentId: EXAM_STUDENT_A,
          decidedAt: new Date("2026-08-02T00:00:00.000Z"),
        },
      ]
    )

    expect(progress.pendingDecisionCount).toBe(0)
    expect(progress.hasFinalizedScores).toBe(true)
  })

  it("確定より後に採点し直されたら、もう一度見る（stale）", () => {
    const progress = buildCell(
      [
        questionScore({
          examStudentId: EXAM_STUDENT_A,
          status: "correct",
          updatedAt: new Date("2026-08-03T00:00:00.000Z"),
        }),
        questionScore({
          examStudentId: EXAM_STUDENT_A,
          status: "incorrect",
        }),
      ],
      [
        {
          examStudentId: EXAM_STUDENT_A,
          decidedAt: new Date("2026-08-02T00:00:00.000Z"),
        },
      ]
    )

    expect(progress.pendingDecisionCount).toBe(1)
    expect(progress.hasFinalizedScores).toBe(false)
  })

  it("判定の一致だけを見る（誰が入れたかで例外を作らない）", () => {
    // 1マス1採点者1行が崩れた行（同期の取りこぼし等）も、割れていれば裁定対象。
    // 出力側のリゾルバがそう扱うので、概要と 08 の画面が食い違わないようにする
    const progress = buildCell([
      questionScore({ examStudentId: EXAM_STUDENT_A, status: "correct" }),
      questionScore({ examStudentId: EXAM_STUDENT_A, status: "incorrect" }),
    ])

    expect(progress.hasFinalizedScores).toBe(false)
  })

  it("unscored は採点の意思表示ではないので食い違いに数えない", () => {
    const progress = buildCell([
      questionScore({
        examStudentId: EXAM_STUDENT_A,
        status: "correct",
      }),
      questionScore({
        examStudentId: EXAM_STUDENT_A,
        status: "unscored",
      }),
    ])

    expect(progress.hasFinalizedScores).toBe(true)
  })

  it("答案画像が無い生徒の食い違いは数えない（採点できないマス）", () => {
    const progress = getExamProgress({
      examPages: [{ id: "page-1" }],
      answerImages: [{ examStudentId: EXAM_STUDENT_A }],
      cropRegions: [
        {
          type: "QUESTION_ANSWER",
          questionScores: [
            questionScore({
              examStudentId: EXAM_STUDENT_B,
              status: "correct",
            }),
            questionScore({
              examStudentId: EXAM_STUDENT_B,
              status: "incorrect",
            }),
          ],
          scoreDecisions: [],
        },
      ],
      examStudents: [
        { id: EXAM_STUDENT_A, status: "participating" },
        { id: EXAM_STUDENT_B, status: "participating" },
      ],
      examSubtotalGroups: [],
    })

    expect(progress.hasFinalizedScores).toBe(true)
  })
})

/**
 * 一覧の「次のステップ」も同じ判定を使う（概要のカードだけが知っている、を作らない）。
 */
describe("getExamWorkflowStatus の採点確定", () => {
  /** 採点まで済んだ試験の進捗。確定の残りだけを差し替える */
  function progressAfterScoring(pendingDecisionCount: number) {
    return {
      hasImages: true,
      hasLayout: true,
      hasRegionInfo: true,
      hasSubtotalRegions: false,
      hasSubtotalGroupSetting: true,
      hasStudents: true,
      hasAnswers: true,
      hasScoring: true,
      hasFinalizedScores: pendingDecisionCount === 0,
      pendingDecisionCount,
      expectedScoringCount: 1,
      actualScoringCount: 1,
      questionAnswerCount: 1,
      answerSheetCount: 1,
    }
  }

  it("裁定が残っていれば 8. 採点確定 を指す", () => {
    const workflow = getExamWorkflowStatus(progressAfterScoring(1), "exam-1")

    expect(workflow.step).toBe(8)
    expect(workflow.text).toBe("採点の割り当てと確定")
    expect(workflow.url).toBe("/exams/exam-1/08-finalize")
  })

  it("残っていなければ 9. 結果 へ飛ばす（単独採点はここを通る）", () => {
    const workflow = getExamWorkflowStatus(progressAfterScoring(0), "exam-1")

    expect(workflow.step).toBe(9)
    expect(workflow.url).toBe("/exams/exam-1/09-export")
  })
})
