/**
 * 要確認の理由・食い違いの判断・表示する試行・消してよい古い試行
 * （docs/vlm-grading-design.md §3・§4-3・§4-4）。
 */

import { describe, expect, it } from "vitest"

import { describeJudgement } from "@/components/exams/07-score-at-once/AiGrading/utils/answerDisplay"
import {
  type AnswerOrder,
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
  scoreOfJudgement,
} from "@/components/exams/07-score-at-once/AiGrading/utils/scoreComparison"
import type { ScoringStatus } from "@/types/scoringStatus.types"

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

  it("点の無い保留は点を持たない（0点にしない）", () => {
    const aiPendingWithoutScore = {
      status: "pending",
      partialScore: null,
    } satisfies Parameters<typeof scoreOfJudgement>[0]
    expect(scoreOfJudgement(aiPendingWithoutScore, POINTS)).toBeNull()
    expect(describeJudgement("pending", null)).toBe("保留")
    expect(describeJudgement("pending", 2)).toBe("保留 2点")
    // 自分も点の無い保留なら一致、自分が保留 0点なら食い違い
    expect(
      isDisagreeing(
        aiPendingWithoutScore,
        makeQuestionScore({ examStudentId: "s", status: "pending" }),
        POINTS
      )
    ).toBe(false)
    expect(
      isDisagreeing(
        aiPendingWithoutScore,
        makeQuestionScore({
          examStudentId: "s",
          status: "pending",
          partialScore: 0,
        }),
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

  describe("並べ方（2段の並べ替え。最後は生徒順）", () => {
    const withJudgement = (
      name: string,
      judgement: { confidence: string; status: ScoringStatus }
    ) =>
      makeAnswer(name, {
        attempts: [
          makeAttemptWithRun({
            examStudentId: name,
            id: `attempt-${name}`,
            ...judgement,
          }),
        ],
      })
    const reviewed = [
      makeAnswer("none"),
      withJudgement("lowCorrect", { confidence: "low", status: "correct" }),
      withJudgement("highIncorrect", {
        confidence: "high",
        status: "incorrect",
      }),
      withJudgement("highCorrect1", { confidence: "high", status: "correct" }),
      withJudgement("mediumPartial", {
        confidence: "medium",
        status: "partial",
      }),
      makeAnswer("errored", {
        attempts: [
          makeAttemptWithRun({
            examStudentId: "errored",
            id: "attempt-errored",
            state: "errored",
          }),
        ],
      }),
      withJudgement("highPending", { confidence: "high", status: "pending" }),
      withJudgement("lowIncorrect", { confidence: "low", status: "incorrect" }),
      withJudgement("highCorrect2", { confidence: "high", status: "correct" }),
    ].map((answer) => ({
      answer,
      review: reviewAnswer(answer, {
        chosenAttemptIdByExamStudentId: new Map(),
        selectedPromptId: null,
        points: POINTS,
      }),
    }))
    const orderedNames = (answerOrder: AnswerOrder) =>
      orderReviewedAnswers(reviewed, answerOrder).map(
        (reviewedAnswer) =>
          reviewedAnswer.answer.studentAnswerImage.examStudentId
      )

    it("確信度順: 確信度の高い順 → 同じ確信度の中は採点種の順。判定の無い答案は最後", () => {
      expect(orderedNames("confidence")).toEqual([
        "highCorrect1",
        "highCorrect2",
        "highPending",
        "highIncorrect",
        "mediumPartial",
        "lowCorrect",
        "lowIncorrect",
        "none",
        "errored",
      ])
    })

    it("採点種順: 採点種の順 → 同じ採点種の中は確信度の高い順。判定の無い答案は未採点として先頭", () => {
      expect(orderedNames("status")).toEqual([
        "none",
        "errored",
        "highCorrect1",
        "highCorrect2",
        "lowCorrect",
        "mediumPartial",
        "highPending",
        "highIncorrect",
        "lowIncorrect",
      ])
    })
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
