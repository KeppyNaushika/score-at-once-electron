/**
 * 問いかけの問いの組み立て・答えの読み書き・見直しの件数・確定で書くこと
 * （docs/vlm-grading-design.md §3-5・§3-10）の純粋な関数。行はすべて作り物。
 */

import { describe, expect, it } from "vitest"

import {
  attemptResponsesForDecision,
  decisionFromAttemptResponses,
  KEEP_OPTION_KEY,
} from "@/components/exams/07-score-at-once/AiGrading/utils/attemptResponseDecision"
import {
  buildCheckQuestioning,
  normalizeTranscription,
} from "@/components/exams/07-score-at-once/AiGrading/utils/checkQuestions"
import { planQuestioningCommit } from "@/components/exams/07-score-at-once/AiGrading/utils/questioningCommitPlan"
import {
  nextStepId,
  previousStepId,
  scoredExamStudentIdsOf,
  summarizeQuestioningReview,
} from "@/components/exams/07-score-at-once/AiGrading/utils/questioningReview"
import {
  decisionBadgeOf,
  memberCountLabelOf,
  type QuestioningScore,
  type QuestioningStep,
  type QuestioningStepState,
} from "@/components/exams/07-score-at-once/AiGrading/utils/questioningSteps"
import type { ScoringStatus } from "@/types/scoringStatus.types"

import { makeAttempt, makeRun } from "./helpers/aiGradingRowFixtures"

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")

const score = (
  status: ScoringStatus,
  partialScore: number | null = null
): QuestioningScore => ({ status, partialScore })

/** 先生の今の採点（受験者 → 点） */
const ownScores =
  (scores: Record<string, QuestioningScore>) => (examStudentId: string) =>
    scores[examStudentId] ?? null

function checkAttempt(
  examStudentId: string,
  transcription: string,
  status: ScoringStatus,
  confidence = "high"
) {
  return makeAttempt({
    id: `check-${examStudentId}`,
    examStudentId,
    runId: "check-run",
    status,
    transcription,
    confidence,
    observation: `${examStudentId} の所見`,
  })
}

describe("AI チェックの問い", () => {
  it("書き起こしは全角半角と空白の揺れを除いて比べる", () => {
    expect(normalizeTranscription(" 緑 葉体　")).toBe("緑葉体")
    expect(normalizeTranscription("ｘ＝３")).toBe("x=3")
  })

  it("同じ答えに違う点の組を作る。AI の判定に合う選択肢が推奨で、組の答案は食い違いに入れない", () => {
    const states = buildCheckQuestioning({
      checkRun: makeRun({
        attempts: [
          checkAttempt("a", "緑葉体", "incorrect"),
          checkAttempt("b", "緑葉体 ", "incorrect"),
          checkAttempt("c", "ｸﾛﾛﾌｨﾙ", "correct"),
          checkAttempt("d", "クロロフィル", "correct"),
        ],
      }),
      ownScoreOf: ownScores({
        a: score("correct"),
        b: score("incorrect"),
        // 同じ点の組は問わない
        c: score("correct"),
        d: score("correct"),
      }),
      points: 3,
    })
    expect(states).toHaveLength(1)
    const [{ step }] = states
    expect(step.kind).toBe("sameAnswer")
    expect(step.title).toBe("同じ答え「緑葉体」に、違う点が付いています")
    expect(step.members.map((member) => member.examStudentId)).toEqual([
      "a",
      "b",
    ])
    expect(
      step.options.map((option) => [option.label, option.recommended])
    ).toEqual([
      ["すべて正答 3点", false],
      ["すべて誤答 0点", true],
      ["このままにする", false],
    ])
    expect(step.allowsManual).toBe(true)
    expect(step.allowsInstruction).toBe(false)
  })

  it("先生と AI の判定が違う答案を、AI の確信度の高い順に出す。採点していない答案は問わない", () => {
    const states = buildCheckQuestioning({
      checkRun: makeRun({
        attempts: [
          checkAttempt("low", "x", "incorrect", "low"),
          checkAttempt("high", "y", "partial", "high"),
          checkAttempt("same", "z", "correct", "high"),
          checkAttempt("unscored", "w", "incorrect", "high"),
        ],
      }),
      ownScoreOf: ownScores({
        low: score("correct"),
        high: score("correct"),
        same: score("correct"),
      }),
      points: 3,
    })
    expect(states.map(({ step }) => step.id)).toEqual([
      "diff:check-high",
      "diff:check-low",
    ])
    const lowStep = states[1].step
    expect(lowStep.title).toBe("あなたは正答 3点、AI は誤答 0点と判定しました")
    expect(lowStep.question).toBe("AI は「low の所見」と見ています。")
    expect(
      lowStep.options.map((option) => [option.label, option.recommended])
    ).toEqual([
      ["誤答 0点 に直す", true],
      ["このままにする", false],
    ])
  })

  it("答案ごとの最新の答えがそろっていればその答えとして読み、そろっていなければ答えていない", () => {
    const run = makeRun({
      attempts: [
        checkAttempt("a", "緑葉体", "incorrect"),
        checkAttempt("b", "緑葉体", "incorrect"),
      ],
    })
    const ownScoreOf = ownScores({
      a: score("correct"),
      b: score("incorrect"),
    })
    const [state] = buildCheckQuestioning({
      checkRun: run,
      ownScoreOf,
      points: 3,
    })
    const rows = attemptResponsesForDecision(state.step, {
      kind: "option",
      optionKey: state.step.options[1].key,
    })
    expect(rows).toEqual([
      {
        attemptId: "check-a",
        choice: "rescore",
        status: "incorrect",
        partialScore: null,
      },
      {
        attemptId: "check-b",
        choice: "rescore",
        status: "incorrect",
        partialScore: null,
      },
    ])
    const responseOf = (
      row: (typeof rows)[number],
      committedAt: Date | null
    ) => ({
      id: `response-${row.attemptId}`,
      ...row,
      committedAt,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    })
    const both = decisionFromAttemptResponses(state.step, (attemptId) => {
      const row = rows.find((candidate) => candidate.attemptId === attemptId)
      return row ? responseOf(row, null) : undefined
    })
    expect(both).toEqual({
      decision: { kind: "option", optionKey: state.step.options[1].key },
      isCommitted: false,
      draftAttemptResponseIds: ["response-check-a", "response-check-b"],
    })
    const onlyOne = decisionFromAttemptResponses(state.step, (attemptId) =>
      attemptId === "check-a" ? responseOf(rows[0], null) : undefined
    )
    expect(onlyOne.decision).toBeNull()
  })
})

/** 合成の問い */
function makeStep(overrides: Partial<QuestioningStep>): QuestioningStep {
  return {
    id: "step",
    kind: "proposal",
    title: "問い",
    question: "",
    detail: "",
    advice: null,
    members: [],
    options: [],
    allowsManual: true,
    allowsInstruction: true,
    ...overrides,
  }
}

const members = (...examStudentIds: string[]) =>
  examStudentIds.map((examStudentId) => ({
    examStudentId,
    attemptId: `attempt-${examStudentId}`,
  }))

describe("見直しと確定", () => {
  const proposalStep = makeStep({
    id: "proposal-1",
    members: members("a", "b"),
    options: [
      {
        key: "option-1",
        label: "−1点",
        description: "",
        recommended: true,
        score: null,
        writesScore: true,
      },
    ],
  })
  const manualStep = makeStep({
    id: "proposal-2",
    members: members("b", "c"),
    options: [],
  })
  const outsideStep = makeStep({
    id: "outside",
    kind: "outside",
    members: members("d"),
    options: [
      {
        key: KEEP_OPTION_KEY,
        label: "このままにする",
        description: "",
        recommended: true,
        score: null,
        writesScore: false,
      },
    ],
    allowsInstruction: false,
  })
  const states: QuestioningStepState[] = [
    {
      step: proposalStep,
      decision: { kind: "option", optionKey: "option-1" },
      isCommitted: false,
      draftProposalResponseId: "draft-1",
      draftAttemptResponseIds: [],
    },
    {
      step: manualStep,
      decision: {
        kind: "manual",
        scores: new Map([["c", score("partial", 2)]]),
      },
      isCommitted: false,
      draftProposalResponseId: "draft-2",
      draftAttemptResponseIds: [],
    },
    {
      step: outsideStep,
      decision: { kind: "option", optionKey: KEEP_OPTION_KEY },
      isCommitted: false,
      draftProposalResponseId: null,
      draftAttemptResponseIds: ["attempt-response-d"],
    },
  ]

  it("確定で点が付く答案を数え、AI 採点では採点済みの答案の置き換えを数える", () => {
    const summary = summarizeQuestioningReview(
      states,
      "grade",
      ownScores({ a: score("correct") })
    )
    expect(
      states.map(
        (state) => scoredExamStudentIdsOf(state, "grade", ownScores({})).length
      )
    ).toEqual([2, 1, 0])
    expect(summary.scoredExamStudentIds).toEqual(["a", "b", "c"])
    expect(summary.overwrittenExamStudentIds).toEqual(["a"])
    expect(summary.draftCount).toBe(3)
    expect(summary.unansweredCount).toBe(0)
    // チェックでは置き換えの知らせを出さない
    expect(
      summarizeQuestioningReview(states, "check", ownScores({}))
        .overwrittenExamStudentIds
    ).toEqual([])
  })

  it("確定で書くことを決める。自分で採点の点は直接書き、書き終えてから確定済みにする", () => {
    const plan = planQuestioningCommit(states, "grade", ownScores({}))
    expect(plan).toEqual({
      scoringMethod: null,
      proposalCommits: [
        {
          proposalId: "proposal-1",
          responseId: "draft-1",
          choosesOption: true,
          examStudentIds: ["a", "b"],
        },
        {
          proposalId: "proposal-2",
          responseId: "draft-2",
          choosesOption: false,
          examStudentIds: ["b", "c"],
        },
      ],
      directScores: [
        { examStudentId: "c", status: "partial", partialScore: 2 },
      ],
      proposalResponseIdsToMark: ["draft-2"],
      attemptResponseIdsToMark: ["attempt-response-d"],
    })
  })

  it("確定済みで変えていない問いは書かない", () => {
    const committed = states.map((state) => ({
      ...state,
      isCommitted: true,
      draftProposalResponseId: null,
      draftAttemptResponseIds: [],
    }))
    const plan = planQuestioningCommit(committed, "grade", ownScores({}))
    expect(plan.proposalCommits).toEqual([])
    expect(plan.directScores).toEqual([])
    expect(
      summarizeQuestioningReview(committed, "grade", ownScores({})).draftCount
    ).toBe(0)
  })

  it("次へは並びの1つ後ろ（答えてあっても飛ばさない。最後からは見直し）。戻るは並びの1つ前", () => {
    const undecided = (id: string): QuestioningStepState => ({
      step: makeStep({ id }),
      decision: null,
      isCommitted: false,
      draftProposalResponseId: null,
      draftAttemptResponseIds: [],
    })
    const ordered = [undecided("a"), states[0], undecided("c")]
    expect(nextStepId(ordered, "a")).toBe("proposal-1")
    expect(nextStepId(ordered, "proposal-1")).toBe("c")
    expect(nextStepId(ordered, "c")).toBeNull()
    expect(previousStepId(ordered, "c")).toBe("proposal-1")
    expect(previousStepId(ordered, "a")).toBeNull()
    // 見直しからは最後の問い
    expect(previousStepId(ordered, null)).toBe("c")
  })
})

describe("問いの一覧の行", () => {
  const scoredStep = makeStep({
    members: members("a", "b"),
    options: [
      score("correct", null),
      score("partial", 4),
      score("incorrect", null),
    ].map((optionScore) => ({
      key: `option-${optionScore.status}`,
      label: "",
      description: "",
      recommended: false,
      score: optionScore,
      writesScore: true,
    })),
  })

  it("点を付ける選択肢は判定の札（正答・誤答は点なし、部分点は点を添える）", () => {
    const badgeOf = (optionKey: string) =>
      decisionBadgeOf(scoredStep, { kind: "option", optionKey })
    expect(badgeOf("option-correct")).toEqual({
      label: "正答",
      status: "correct",
    })
    expect(badgeOf("option-partial")).toEqual({
      label: "部分点 4点",
      status: "partial",
    })
    expect(badgeOf("option-incorrect")).toEqual({
      label: "誤答",
      status: "incorrect",
    })
  })

  it("自分で採点・再採点の指示は色の無い札。件数は案と案の外の問いだけに添える", () => {
    expect(
      decisionBadgeOf(scoredStep, {
        kind: "manual",
        scores: new Map([["a", score("correct", null)]]),
      })
    ).toEqual({ label: "自分で採点 1件", status: null })
    expect(
      decisionBadgeOf(scoredStep, { kind: "instruction", text: "指示" })
    ).toEqual({ label: "再採点を指示", status: null })
    expect(memberCountLabelOf(scoredStep)).toBe("2件")
    expect(
      memberCountLabelOf(
        makeStep({ kind: "disagreement", members: members("a") })
      )
    ).toBeNull()
  })

  it("見直しは、下書きで助言を直した問いを数える", () => {
    const withAdvice = (text: string): QuestioningStepState => ({
      step: makeStep({ advice: { baseText: "単位を書こう。", text } }),
      decision: { kind: "instruction", text: "指示" },
      isCommitted: false,
      draftProposalResponseId: "draft",
      draftAttemptResponseIds: [],
    })
    expect(
      summarizeQuestioningReview(
        [withAdvice("cm まで書こう。"), withAdvice("単位を書こう。")],
        "grade",
        ownScores({})
      ).adviceEditCount
    ).toBe(1)
  })
})
