/**
 * 要確認の理由・食い違いの判断・表示する試行・消してよい古い試行
 * （docs/vlm-grading-design.md §3・§4-3・§4-4）。
 */

import { describe, expect, it } from "vitest"

import {
  orderReviewedAnswers,
  reviewAnswer,
} from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import {
  resolveDefaultPromptId,
  resolveDisplayedAttempt,
  selectDeletableOldAttemptIds,
} from "@/components/exams/07-score-at-once/AiGrading/utils/attemptSelection"
import { classifyReviewReasons } from "@/components/exams/07-score-at-once/AiGrading/utils/reviewReasons"
import {
  findOwnQuestionScore,
  isDisagreeing,
  isWithinOnePoint,
} from "@/components/exams/07-score-at-once/AiGrading/utils/scoreComparison"

import {
  makeAnswer,
  makeAttemptWithRun,
  makeInk,
  makePrompt,
  makeQuestionScore,
  makeRun,
} from "./helpers/aiGradingRowFixtures"

const POINTS = 4

describe("食い違いの判断", () => {
  it("判定と点の両方で比べ、自分が採点していなければ食い違いではない", () => {
    const aiPartial = { status: "partial" as const, partialScore: 2 }
    expect(
      isDisagreeing(
        aiPartial,
        makeQuestionScore({ examStudentId: "s" }),
        POINTS
      )
    ).toBe(true)
    expect(isDisagreeing(aiPartial, undefined, POINTS)).toBe(false)
    expect(
      isDisagreeing(
        { status: "correct", partialScore: null },
        makeQuestionScore({ examStudentId: "s" }),
        POINTS
      )
    ).toBe(false)
  })

  it("±1点以内の判断は点の差で行う", () => {
    expect(
      isWithinOnePoint(
        { status: "partial", partialScore: 3 },
        { status: "correct", partialScore: null },
        POINTS
      )
    ).toBe(true)
  })

  it("設問の id が空なら投げる", () => {
    expect(() => findOwnQuestionScore([], "", "s", "user-1")).toThrow()
  })
})

describe("要確認の理由", () => {
  it("失敗・拒否・保留・確信度・はみ出し・境界帯・食い違いを拾う", () => {
    expect(
      classifyReviewReasons({
        displayedAttempt: makeAttemptWithRun({
          examStudentId: "s",
          status: "pending",
          partialScore: 1,
          confidence: "low",
        }),
        questionScore: makeQuestionScore({ examStudentId: "s" }),
        inkMeasurement: makeInk({
          overflowsFrame: true,
          blankness: "borderline",
        }),
        points: POINTS,
      })
    ).toEqual([
      "aiHold",
      "lowConfidence",
      "overflow",
      "disagreement",
      "borderline",
    ])
    expect(
      classifyReviewReasons({
        displayedAttempt: makeAttemptWithRun({
          examStudentId: "s",
          state: "refused",
        }),
        questionScore: undefined,
        inkMeasurement: null,
        points: POINTS,
      })
    ).toEqual(["refused"])
  })
})

describe("表示する試行と印", () => {
  const newestErrored = makeAttemptWithRun(
    {
      examStudentId: "s",
      id: "a-new",
      state: "errored",
      createdAt: new Date("2026-10-03T00:00:00.000Z"),
    },
    { id: "run-new", promptId: "prompt-2" }
  )
  const olderSucceeded = makeAttemptWithRun(
    {
      examStudentId: "s",
      id: "a-old",
      createdAt: new Date("2026-10-02T00:00:00.000Z"),
      adoptedAt: new Date("2026-10-02T00:00:00.000Z"),
    },
    { id: "run-old", promptId: "prompt-1" }
  )
  const attempts = [newestErrored, olderSucceeded]

  it("既定は最新の成功したもの。選んだものがあればそれ", () => {
    expect(resolveDisplayedAttempt(attempts, undefined)?.attempt.id).toBe(
      "a-old"
    )
    expect(resolveDisplayedAttempt(attempts, "a-new")?.attempt.id).toBe("a-new")
  })

  it("別のプロンプト・採用済み・採用後の変更を印にする", () => {
    const review = reviewAnswer(
      makeAnswer("s", {
        attempts,
        questionScore: makeQuestionScore({
          examStudentId: "s",
          status: "incorrect",
        }),
      }),
      {
        chosenAttemptIdByExamStudentId: new Map(),
        selectedPromptId: "prompt-2",
        points: POINTS,
      }
    )
    expect(review.isFromOtherPrompt).toBe(true)
    expect(review.isAdopted).toBe(true)
    expect(review.isChangedAfterAdoption).toBe(true)
  })

  it("確信度順は高い順で、判定の無い答案は最後。同じ確信度の中は生徒順のまま", () => {
    const withConfidence = (name: string, confidence: string) =>
      makeAnswer(name, {
        attempts: [
          makeAttemptWithRun({
            examStudentId: name,
            id: `attempt-${name}`,
            confidence,
          }),
        ],
      })
    const reviewed = [
      makeAnswer("none"),
      withConfidence("low", "low"),
      withConfidence("high1", "high"),
      withConfidence("medium", "medium"),
      withConfidence("high2", "high"),
    ].map((answer) => ({
      answer,
      review: reviewAnswer(answer, {
        chosenAttemptIdByExamStudentId: new Map(),
        selectedPromptId: null,
        points: POINTS,
      }),
    }))
    expect(
      orderReviewedAnswers(reviewed, "confidence").map(
        (reviewedAnswer) =>
          reviewedAnswer.answer.studentAnswerImage.examStudentId
      )
    ).toEqual(["high1", "high2", "medium", "low", "none"])
  })

  it("古い試行: 最新・採用済み・結果待ちは消さない", () => {
    const pendingOld = makeAttemptWithRun({
      examStudentId: "s",
      id: "a-pending",
      state: "pending",
    })
    expect(
      selectDeletableOldAttemptIds([
        [newestErrored, olderSucceeded, pendingOld],
        [
          makeAttemptWithRun({ examStudentId: "t", id: "t-new" }),
          makeAttemptWithRun({ examStudentId: "t", id: "t-old" }),
        ],
      ])
    ).toEqual(["t-old"])
  })

  it("既定のプロンプトは自分が最後に採点に使ったもの、無ければ最新", () => {
    const prompts = [makePrompt({ id: "p1" }), makePrompt({ id: "p2" })]
    expect(resolveDefaultPromptId(prompts, [], "user-1")).toBe("p2")
    expect(
      resolveDefaultPromptId(prompts, [makeRun({ promptId: "p1" })], "user-1")
    ).toBe("p1")
    expect(resolveDefaultPromptId([], [], "user-1")).toBeNull()
  })
})
