/**
 * AI採点モードの一覧（docs/vlm-grading-design.md §10）。
 *
 * ここで固定すること:
 * - 答案の下の札は、採用の前か後かを1つの状態に分ける（提案・採用済み・採用後に変更・未判定・失敗…）
 * - 絞り込みは「自分の採点」と「AI の採点」の2組で、組の中は OR、組どうしは AND
 * - 採点種順は、マスに見えている状態（自分の採点、無ければ成功した AI の判定）で並べる
 * - 選んだ答案の採用は、成功した判定のあるものだけを、点だけ書く（AI の朱書きの文案は採用しない）
 */

import { describe, expect, it } from "vitest"

import type {
  AiGradingAnswer,
  AiGradingAttemptRow,
} from "@/components/exams/07-score-at-once/AiGrading/types"
import {
  cellStatusOf,
  DEFAULT_AI_GRID_FILTER_SETTINGS,
  isShownByFilter,
} from "@/components/exams/07-score-at-once/AiGrading/utils/aiGridFilter"
import {
  toAiGridItem,
  toStudentAnswerImageIds,
} from "@/components/exams/07-score-at-once/AiGrading/utils/aiGridItems"
import {
  orderReviewedAnswers,
  reviewAnswer,
} from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import { neighborAttemptId } from "@/components/exams/07-score-at-once/AiGrading/utils/attemptSelection"
import { classifyProposalChip } from "@/components/exams/07-score-at-once/AiGrading/utils/proposalChip"
import { planSelectionAdoption } from "@/components/exams/07-score-at-once/AiGrading/utils/selectionAdoption"
import { selectQuestionsWithUnreflectedAiJudgements } from "@/components/exams/07-score-at-once/AiGrading/utils/unreflectedQuestions"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
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
  scoringMethod: "points",
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

  it("自分が採点していればその判定、していなければ成功した AI の判定、どちらも無ければ未採点", () => {
    expect(cellStatusOf(correctProposalUnscoredByMe)).toBe("correct")
    expect(cellStatusOf(failedButScoredByMe)).toBe("incorrect")
    expect(cellStatusOf(reviewed(makeAnswer("s3")))).toBe("unscored")
    const scoredOverProposal = reviewed(
      answerWithAttempt(
        "s4",
        { status: "correct" },
        {
          questionScore: makeQuestionScore({
            examStudentId: "s4",
            status: "partial",
            partialScore: 1,
          }),
        }
      )
    )
    expect(cellStatusOf(scoredOverProposal)).toBe("partial")
  })

  it("組の中は OR、自分の採点と AI の採点は AND", () => {
    const unscoredByMeAnyAi = {
      mine: { ...DEFAULT_AI_GRID_FILTER_SETTINGS.mine },
      ai: { ...DEFAULT_AI_GRID_FILTER_SETTINGS.ai, unscored: true },
    }
    expect(
      isShownByFilter(correctProposalUnscoredByMe, unscoredByMeAnyAi)
    ).toBe(true)
    // 自分が誤答にしたので、自分の採点の組で落ちる
    expect(isShownByFilter(failedButScoredByMe, unscoredByMeAnyAi)).toBe(false)
    const withoutAiCorrect = {
      mine: unscoredByMeAnyAi.mine,
      ai: { ...unscoredByMeAnyAi.ai, correct: false },
    }
    expect(isShownByFilter(correctProposalUnscoredByMe, withoutAiCorrect)).toBe(
      false
    )
  })

  it("既定は、自分が未採点で AI の判定がある答案だけ", () => {
    expect(
      isShownByFilter(
        correctProposalUnscoredByMe,
        DEFAULT_AI_GRID_FILTER_SETTINGS
      )
    ).toBe(true)
    expect(
      isShownByFilter(
        reviewed(makeAnswer("s3")),
        DEFAULT_AI_GRID_FILTER_SETTINGS
      )
    ).toBe(false)
    expect(
      isShownByFilter(failedButScoredByMe, DEFAULT_AI_GRID_FILTER_SETTINGS)
    ).toBe(false)
  })

  it("採点種順は、マスの状態を絞り込みのボタンと同じ順に並べる", () => {
    const unscored = reviewed(makeAnswer("s3"))
    expect(
      orderReviewedAnswers(
        [failedButScoredByMe, unscored, correctProposalUnscoredByMe],
        "status"
      )
    ).toEqual([unscored, correctProposalUnscoredByMe, failedButScoredByMe])
  })
})

describe("選んだ答案の採用", () => {
  it("成功した判定のあるものだけを採用し（点だけ。AI の朱書きの文案は運ばない）、採点済みと採用できないものを数える", () => {
    const plan = planSelectionAdoption([
      reviewed(answerWithAttempt("s1", { annotationText: "式を書こう" })),
      reviewed(
        answerWithAttempt(
          "s2",
          {},
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
    ])
    expect(plan.adoptions).toEqual([
      { attemptId: "attempt-s1" },
      { attemptId: "attempt-s2" },
    ])
    expect(plan.overwriteCount).toBe(1)
    expect(plan.skippedCount).toBe(2)
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

describe("設問一覧の印（AI の判定が未反映）", () => {
  const otherCropRegionId = "crop-region-other"

  it("自分の成功した判定があり、自分が未採点の答案がある設問だけを返す", () => {
    const unscoredWithJudgement = makeAttemptWithRun({ examStudentId: "s1" })
    const scoredWithJudgement = makeAttemptWithRun(
      { examStudentId: "s2" },
      { id: "run-2" }
    )
    const failedOnly = makeAttemptWithRun(
      { examStudentId: "s3", state: "errored" },
      { id: "run-3" }
    )
    const scoredRun = {
      ...scoredWithJudgement.run,
      prompt: {
        ...scoredWithJudgement.run.prompt,
        cropRegionId: otherCropRegionId,
      },
    }
    const failedRun = {
      ...failedOnly.run,
      prompt: { ...failedOnly.run.prompt, cropRegionId: "crop-region-failed" },
    }
    const questionScoresByCropRegionId = new Map([
      [
        otherCropRegionId,
        [
          makeQuestionScore({
            examStudentId: "s2",
            cropRegionId: otherCropRegionId,
            status: "correct",
          }),
        ],
      ],
    ])
    expect(
      selectQuestionsWithUnreflectedAiJudgements(
        [unscoredWithJudgement.run, scoredRun, failedRun],
        questionScoresByCropRegionId,
        CURRENT_USER_ID
      )
    ).toEqual(new Set([CROP_REGION_ID]))
  })

  it("未採点の行・他の教員の採点は自分の採点に数えず、改訂の実行は見ない", () => {
    const unscoredRow = makeAttemptWithRun({ examStudentId: "s1" })
    const scoredByOtherUser = makeAttemptWithRun(
      { examStudentId: "s2" },
      { id: "run-other-user" }
    )
    const revision = makeAttemptWithRun(
      { examStudentId: "s3" },
      { id: "run-revise", purpose: "revise" }
    )
    const runOn = (
      attemptWithRun: ReturnType<typeof makeAttemptWithRun>,
      cropRegionId: string
    ) => ({
      ...attemptWithRun.run,
      prompt: { ...attemptWithRun.run.prompt, cropRegionId },
    })
    const questionScoresByCropRegionId = new Map([
      [
        CROP_REGION_ID,
        [makeQuestionScore({ examStudentId: "s1", status: "unscored" })],
      ],
      [
        otherCropRegionId,
        [
          makeQuestionScore({
            examStudentId: "s2",
            cropRegionId: otherCropRegionId,
            userId: "other-user",
          }),
        ],
      ],
    ])
    expect(
      selectQuestionsWithUnreflectedAiJudgements(
        [
          unscoredRow.run,
          runOn(scoredByOtherUser, otherCropRegionId),
          runOn(revision, "crop-region-revise"),
        ],
        questionScoresByCropRegionId,
        CURRENT_USER_ID
      )
    ).toEqual(new Set([CROP_REGION_ID, otherCropRegionId]))
  })
})

describe("自分の採点を書く答案の id", () => {
  it("マスの id（examStudentId）ではなく、一覧表示の一括採点が受け取る答案画像の id にする", () => {
    const gridItems = ["s1", "s2"].map((examStudentId) =>
      toAiGridItem(
        {
          answer: makeAnswer(examStudentId),
          review: reviewAnswer(makeAnswer(examStudentId), {
            chosenAttemptIdByExamStudentId: new Map(),
            selectedPromptId: "prompt-1",
            points: POINTS,
          }),
        },
        cropRegion
      )
    )
    expect(gridItems.map((gridItem) => gridItem.id)).toEqual(["s1", "s2"])
    expect(toStudentAnswerImageIds(gridItems)).toEqual([
      "answer-image-s1",
      "answer-image-s2",
    ])
  })
})
