/**
 * AI採点モードの一覧（docs/vlm-grading-design.md §10）。
 *
 * ここで固定すること:
 * - 答案の下の札は、採用の前か後かを1つの状態に分ける（提案・採用済み・採用後に変更・未判定・失敗…）
 * - 絞り込みの基準「AIの提案」では、成功した判定が無い答案は未採点として扱う
 * - 選んだ答案の採用は、成功した判定のあるものだけを、直した下書きがあればその形で書く
 */

import { describe, expect, it } from "vitest"

import type {
  AiGradingAnswer,
  AiGradingAttemptRow,
} from "@/components/exams/07-score-at-once/AiGrading/types"
import {
  adoptionAnnotationFromDraft,
  draftAnnotationsFromPlacement,
} from "@/components/exams/07-score-at-once/AiGrading/utils/adoptionAnnotation"
import {
  ALL_STATUSES_VISIBLE,
  filterStatusOf,
  isShownByFilter,
} from "@/components/exams/07-score-at-once/AiGrading/utils/aiGridFilter"
import { toAiGridItem } from "@/components/exams/07-score-at-once/AiGrading/utils/aiGridItems"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import { neighborAttemptId } from "@/components/exams/07-score-at-once/AiGrading/utils/attemptSelection"
import { classifyProposalChip } from "@/components/exams/07-score-at-once/AiGrading/utils/proposalChip"
import { planSelectionAdoption } from "@/components/exams/07-score-at-once/AiGrading/utils/selectionAdoption"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { newDrawingAnnotation } from "@/types/drawingAnnotation.types"

import {
  CROP_REGION_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makeAttemptWithRun,
  makeQuestionScore,
} from "./helpers/aiGradingRowFixtures"

const POINTS = 4
const ADOPTED_AT = new Date("2026-10-02T00:00:00.000Z")

const cropRegion: QuestionAnswerRegionRow = {
  id: CROP_REGION_ID,
  examPageId: EXAM_PAGE_ID,
  label: "1-(1)",
  type: "QUESTION_ANSWER",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.2,
  points: POINTS,
  orderIndex: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  examPage: {
    id: EXAM_PAGE_ID,
    examId: "exam-1",
    pageNumber: 1,
    imagePath: "master/page1.png",
    pageSize: "A4",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  cropSubtotals: [],
}

function reviewed(answer: AiGradingAnswer) {
  return {
    answer,
    review: reviewAnswer(answer, {
      chosenAttemptIdByExamStudentId: new Map(),
      selectedPromptId: "prompt-1",
      points: POINTS,
    }),
  }
}

function answerWithAttempt(
  examStudentId: string,
  attemptOverrides: Partial<AiGradingAttemptRow> = {},
  answerOverrides: Partial<AiGradingAnswer> = {}
) {
  return makeAnswer(examStudentId, {
    attempts: [makeAttemptWithRun({ examStudentId, ...attemptOverrides })],
    ...answerOverrides,
  })
}

describe("答案の下の札", () => {
  it("試行が無ければ AI未判定", () => {
    expect(classifyProposalChip(reviewed(makeAnswer("s1")))).toBe("none")
  })

  it("結果待ち・失敗・期限切れ・拒否を分ける", () => {
    expect(
      classifyProposalChip(
        reviewed(answerWithAttempt("s1", { state: "pending" }))
      )
    ).toBe("awaiting")
    expect(
      classifyProposalChip(
        reviewed(answerWithAttempt("s1", { state: "errored" }))
      )
    ).toBe("failed")
    expect(
      classifyProposalChip(
        reviewed(answerWithAttempt("s1", { state: "expired" }))
      )
    ).toBe("failed")
    expect(
      classifyProposalChip(
        reviewed(answerWithAttempt("s1", { state: "refused" }))
      )
    ).toBe("refused")
  })

  it("成功した判定を採用していなければ提案（自分が採点済みでも）", () => {
    expect(classifyProposalChip(reviewed(answerWithAttempt("s1")))).toBe(
      "proposal"
    )
    expect(
      classifyProposalChip(
        reviewed(
          answerWithAttempt(
            "s1",
            {},
            {
              questionScore: makeQuestionScore({
                examStudentId: "s1",
                status: "incorrect",
              }),
            }
          )
        )
      )
    ).toBe("proposal")
  })

  it("採用して自分の採点が判定のままなら採用済み、変えていれば採用後に変更", () => {
    const adoptedAttempt: Partial<AiGradingAttemptRow> = {
      status: "partial",
      partialScore: 2,
      adoptedAt: ADOPTED_AT,
    }
    expect(
      classifyProposalChip(
        reviewed(
          answerWithAttempt("s1", adoptedAttempt, {
            questionScore: makeQuestionScore({
              examStudentId: "s1",
              status: "partial",
              partialScore: 2,
            }),
          })
        )
      )
    ).toBe("adopted")
    expect(
      classifyProposalChip(
        reviewed(
          answerWithAttempt("s1", adoptedAttempt, {
            questionScore: makeQuestionScore({
              examStudentId: "s1",
              status: "partial",
              partialScore: 3,
            }),
          })
        )
      )
    ).toBe("changed")
    // 採用したあとで未採点に戻した
    expect(
      classifyProposalChip(reviewed(answerWithAttempt("s1", adoptedAttempt)))
    ).toBe("changed")
  })
})

describe("絞り込み", () => {
  const correctProposalUnscoredByMe = reviewed(
    answerWithAttempt("s1", { status: "correct" })
  )
  const failedButScoredByMe = reviewed(
    answerWithAttempt(
      "s2",
      { state: "errored" },
      {
        questionScore: makeQuestionScore({
          examStudentId: "s2",
          status: "incorrect",
        }),
      }
    )
  )

  it("AIの提案が基準なら、成功した判定の状態。無ければ未採点", () => {
    expect(filterStatusOf(correctProposalUnscoredByMe, "ai")).toBe("correct")
    expect(filterStatusOf(failedButScoredByMe, "ai")).toBe("unscored")
    expect(filterStatusOf(reviewed(makeAnswer("s3")), "ai")).toBe("unscored")
  })

  it("自分の採点が基準なら、自分の採点の状態", () => {
    expect(filterStatusOf(correctProposalUnscoredByMe, "mine")).toBe("unscored")
    expect(filterStatusOf(failedButScoredByMe, "mine")).toBe("incorrect")
  })

  it("切った状態の答案は残らない", () => {
    const onlyUnscored = {
      ...ALL_STATUSES_VISIBLE,
      correct: false,
      incorrect: false,
    }
    expect(
      isShownByFilter(correctProposalUnscoredByMe, onlyUnscored, "ai")
    ).toBe(false)
    expect(
      isShownByFilter(correctProposalUnscoredByMe, onlyUnscored, "mine")
    ).toBe(true)
    expect(isShownByFilter(failedButScoredByMe, onlyUnscored, "ai")).toBe(true)
    expect(isShownByFilter(failedButScoredByMe, onlyUnscored, "mine")).toBe(
      false
    )
  })
})

describe("選んだ答案の採用", () => {
  const context = {
    cropRegion,
    pageSize: "A4",
    draftAnnotationsByAttemptId: new Map(),
  }

  it("成功した判定のあるものだけを採用し、採点済みと採用できないものを数える", () => {
    const plan = planSelectionAdoption(
      [
        reviewed(answerWithAttempt("s1", { annotationText: "式を書こう" })),
        reviewed(
          answerWithAttempt(
            "s2",
            { annotationText: "" },
            {
              questionScore: makeQuestionScore({
                examStudentId: "s2",
                status: "incorrect",
              }),
            }
          )
        ),
        reviewed(answerWithAttempt("s3", { state: "errored" })),
        reviewed(makeAnswer("s4")),
      ],
      context
    )
    expect(plan.adoptions.map((adoption) => adoption.attemptId)).toEqual([
      "attempt-s1",
      "attempt-s2",
    ])
    // 注釈文が空なら注釈は無い。あれば答案ごとに置き場所を求める
    expect(plan.adoptions[0].annotation).toMatchObject({
      text: expect.stringContaining("式を書こう"),
      fontSize: 5,
    })
    expect(plan.adoptions[1].annotation).toBeNull()
    expect(plan.overwriteCount).toBe(1)
    expect(plan.skippedCount).toBe(2)
  })

  it("直した下書きがあれば、求めた置き場所ではなくその形で書く。消していれば注釈なし", () => {
    const edited = newDrawingAnnotation({
      type: "text",
      x: 0.42,
      y: 0.24,
      text: "直した朱書き",
      fontSize: 3.5,
    })
    const plan = planSelectionAdoption(
      [
        reviewed(answerWithAttempt("s1", { annotationText: "元の朱書き" })),
        reviewed(answerWithAttempt("s2", { annotationText: "消す朱書き" })),
      ],
      {
        ...context,
        draftAnnotationsByAttemptId: new Map([
          ["attempt-s1", [edited]],
          ["attempt-s2", []],
        ]),
      }
    )
    expect(plan.adoptions).toEqual([
      {
        attemptId: "attempt-s1",
        annotation: { x: 0.42, y: 0.24, text: "直した朱書き", fontSize: 3.5 },
      },
      { attemptId: "attempt-s2", annotation: null },
    ])
  })

  it("下書きの初めの形は置き場所そのもの（直さずに採用すれば同じものを書く）", () => {
    const placement = {
      x: 0.2,
      y: 0.15,
      text: "途中式",
      fontSize: 5,
      lineCount: 1,
      overlapsInk: false,
      exceedsRegion: false,
    }
    expect(
      adoptionAnnotationFromDraft(draftAnnotationsFromPlacement(placement))
    ).toEqual({ x: 0.2, y: 0.15, text: "途中式", fontSize: 5 })
    expect(draftAnnotationsFromPlacement(null)).toEqual([])
  })
})

describe("一覧のマスと試行の見比べ", () => {
  it("マスの id は受験者の id、色と点は自分の採点", () => {
    const gridItem = toAiGridItem(
      reviewed(
        answerWithAttempt(
          "s1",
          { status: "correct" },
          {
            questionScore: makeQuestionScore({
              examStudentId: "s1",
              status: "partial",
              partialScore: 1,
            }),
          }
        )
      ),
      cropRegion
    )
    expect(gridItem).toMatchObject({
      id: "s1",
      examStudentId: "s1",
      status: "partial",
      currentScore: 1,
      maxScore: POINTS,
    })
  })

  it("`<` は古い判定、`>` は新しい判定。端なら動かない", () => {
    const attempts = [
      makeAttemptWithRun({ examStudentId: "s1", id: "newest" }),
      makeAttemptWithRun({ examStudentId: "s1", id: "middle" }),
      makeAttemptWithRun({ examStudentId: "s1", id: "oldest" }),
    ]
    expect(neighborAttemptId(attempts, "middle", "older")).toBe("oldest")
    expect(neighborAttemptId(attempts, "middle", "newer")).toBe("newest")
    expect(neighborAttemptId(attempts, "oldest", "older")).toBeNull()
    expect(neighborAttemptId(attempts, "newest", "newer")).toBeNull()
    expect(neighborAttemptId(attempts, null, "older")).toBeNull()
  })
})
