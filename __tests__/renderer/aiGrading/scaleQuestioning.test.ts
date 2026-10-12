/**
 * 類型方式の設問の問いかけ（docs/vlm-grading-design.md §4-8-5・§4-8-6）の純粋な関数。
 *
 * - 案の選択肢は類型（「A にする」）・無答・保留で、採点方式は問わない
 * - 決めたことの札は類型の記号を類型の色で出す
 * - 確定で作る項目は類型にする項目（`setScaleLevelId`）で、設問の類型表の類型だけを通す
 * - 直接決めた点・答案ごとの答えは類型を運ぶ
 * - AIチェックは類型で比べる（点数が同じでも類型が違えば違う点）
 *
 * 行はすべて作り物。
 */

import { describe, expect, it } from "vitest"

import {
  attemptResponsesForDecision,
  decisionFromAttemptResponses,
} from "@/components/exams/07-score-at-once/AiGrading/utils/attemptResponseDecision"
import { buildCheckQuestioning } from "@/components/exams/07-score-at-once/AiGrading/utils/checkQuestions"
import {
  buildGradingQuestioning,
  SCORING_METHOD_STEP_ID,
} from "@/components/exams/07-score-at-once/AiGrading/utils/gradingQuestions"
import { planQuestioningCommit } from "@/components/exams/07-score-at-once/AiGrading/utils/questioningCommitPlan"
import { draftScoresOf } from "@/components/exams/07-score-at-once/AiGrading/utils/questioningDraftScores"
import {
  decisionBadgeOf,
  isSameQuestioningScore,
  type QuestioningScore,
} from "@/components/exams/07-score-at-once/AiGrading/utils/questioningSteps"
import {
  type AiRubricProposalRow,
  optionEffectOf,
} from "@/components/exams/07-score-at-once/AiGrading/utils/rubricProposals"
import { scaleLevelColorsAt } from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import { validateRubricItemEffect } from "@/lib/shared/rubric/rubricItemValidator"

import { makeAttempt, makeRun } from "./helpers/aiGradingRowFixtures"

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")
const LEVEL_A = "level-a"
const LEVEL_B = "level-b"
const SCALE_LEVELS = [
  { id: LEVEL_A, label: "A" },
  { id: LEVEL_B, label: "B" },
]
const SCALE_REGION = {
  scoringMethod: "scale",
  points: 10,
  scaleLevelIds: [LEVEL_A, LEVEL_B],
}

type OptionRow = AiRubricProposalRow["options"][number]

function makeOption(overrides: Partial<OptionRow> & { id: string }): OptionRow {
  return {
    proposalId: "proposal-scale",
    effectKind: "set",
    pointDelta: null,
    setStatus: "evaluated",
    setScore: null,
    setScaleLevelId: LEVEL_A,
    rationale: "",
    recommended: false,
    sortOrder: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

function makeScaleProposal(): AiRubricProposalRow {
  const attempt = makeAttempt({
    examStudentId: "s-a",
    status: "evaluated",
    scaleLevelId: LEVEL_A,
  })
  return {
    id: "proposal-scale",
    runId: "group-run-1",
    label: "根拠を2つ挙げている",
    description: "",
    adviceDraft: "",
    matchedRubricItemId: null,
    matchedRubricItem: null,
    sortOrder: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    options: [
      makeOption({ id: "option-a", recommended: true }),
      makeOption({ id: "option-b", setScaleLevelId: LEVEL_B, sortOrder: 1 }),
      makeOption({
        id: "option-no-answer",
        setStatus: "no_answer",
        setScaleLevelId: null,
        sortOrder: 2,
      }),
    ],
    members: [
      {
        id: "member-s-a",
        proposalId: "proposal-scale",
        attemptId: attempt.id,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        attempt,
      },
    ],
    responses: [],
    adviceDrafts: [],
    instructionDrafts: [],
  }
}

const levelScore = (scaleLevelId: string): QuestioningScore => ({
  status: "evaluated",
  partialScore: null,
  scaleLevelId,
})

const buildScaleQuestioning = () =>
  buildGradingQuestioning({
    proposalRun: {
      questioningScoringMethod: "",
      rubricProposals: [makeScaleProposal()],
    },
    sourceGradeRun: null,
    scoringMethod: "scale",
    points: 10,
    scaleLevels: SCALE_LEVELS,
  })

describe("類型方式の設問の AI採点の問い", () => {
  it("選択肢は「A にする」のように類型の記号で出し、点は類型を運ぶ。採点方式は問わない", () => {
    const states = buildScaleQuestioning()
    expect(states.map((state) => state.step.id)).not.toContain(
      SCORING_METHOD_STEP_ID
    )
    const [{ step }] = states
    expect(step.options.map((option) => option.label)).toEqual([
      "A にする",
      "B にする",
      "無答 0点",
    ])
    expect(step.options[1].score).toEqual(levelScore(LEVEL_B))
  })

  it("決めたことの札は類型の記号を、類型の並び順の色で出す", () => {
    const [{ step }] = buildScaleQuestioning()
    expect(
      decisionBadgeOf(
        step,
        { kind: "option", optionKey: "option-b" },
        SCALE_LEVELS
      )
    ).toEqual({
      label: "B",
      status: "evaluated",
      scaleColors: scaleLevelColorsAt(1),
    })
    // 類型表に無い類型（消えた類型）は色を持たない
    expect(
      decisionBadgeOf(step, { kind: "option", optionKey: "option-b" }, [])
    ).toEqual({ label: "類型（なし）", status: "evaluated", scaleColors: null })
  })

  it("焦点のある類型の選択肢で付く予定の点は、その類型", () => {
    const states = buildScaleQuestioning()
    const draftScores = draftScoresOf({
      states,
      mode: "grade",
      ownScoreOf: () => null,
      preview: {
        stepId: states[0].step.id,
        decision: { kind: "option", optionKey: "option-b" },
      },
      pointDeltaOf: () => null,
      scoringMethod: "scale",
      points: 10,
    })
    expect(draftScores.get("s-a")).toEqual(levelScore(LEVEL_B))
  })

  it("確定で作る項目は類型にする項目で、設問の類型表の類型だけを通す", () => {
    const option = makeScaleProposal().options[1]
    const validation = validateRubricItemEffect(
      optionEffectOf(option),
      SCALE_REGION
    )
    expect(validation).toEqual({
      ok: true,
      value: {
        effectKind: "set",
        pointDelta: null,
        setStatus: "evaluated",
        setScore: null,
        setScaleLevelId: LEVEL_B,
      },
    })
    // 類型表を替える前の類型は通さない
    expect(
      validateRubricItemEffect(optionEffectOf(option), {
        ...SCALE_REGION,
        scaleLevelIds: [LEVEL_A],
      }).ok
    ).toBe(false)
  })

  it("自分で採点した類型は、教員が直接決めた点として類型ごと書く", () => {
    const [state] = buildScaleQuestioning()
    const plan = planQuestioningCommit(
      [
        {
          ...state,
          decision: {
            kind: "manual",
            scores: new Map([["s-a", levelScore(LEVEL_B)]]),
          },
          draftProposalResponseId: "draft-1",
        },
      ],
      "grade",
      () => null
    )
    expect(plan.directScores).toEqual([
      {
        examStudentId: "s-a",
        status: "evaluated",
        partialScore: null,
        scaleLevelId: LEVEL_B,
      },
    ])
    expect(plan.proposalCommits).toEqual([
      {
        proposalId: "proposal-scale",
        responseId: "draft-1",
        choosesOption: false,
        examStudentIds: ["s-a"],
      },
    ])
  })
})

describe("類型方式の設問の AIチェック", () => {
  function checkAttempt(
    examStudentId: string,
    transcription: string,
    scaleLevelId: string
  ) {
    return makeAttempt({
      id: `check-${examStudentId}`,
      examStudentId,
      runId: "check-run",
      status: "evaluated",
      scaleLevelId,
      transcription,
      observation: `${examStudentId} の所見`,
    })
  }

  it("類型が違えば、点数が同じでも違う点として扱う", () => {
    expect(
      isSameQuestioningScore(levelScore(LEVEL_A), levelScore(LEVEL_B))
    ).toBe(false)
    expect(
      isSameQuestioningScore(levelScore(LEVEL_A), levelScore(LEVEL_A))
    ).toBe(true)
  })

  it("先生と AI の類型が違う答案を「あなたは A、AI は B と判定しました」と問い、「B に直す」を推奨にする", () => {
    const states = buildCheckQuestioning({
      checkRun: makeRun({
        attempts: [
          checkAttempt("differ", "x", LEVEL_B),
          checkAttempt("same", "y", LEVEL_A),
        ],
      }),
      ownScoreOf: () => levelScore(LEVEL_A),
      points: 10,
      scaleLevels: SCALE_LEVELS,
    })
    expect(states).toHaveLength(1)
    const [{ step }] = states
    expect(step.title).toBe("あなたは A、AI は B と判定しました")
    expect(
      step.options.map((option) => [option.label, option.recommended])
    ).toEqual([
      ["B に直す", true],
      ["このままにする", false],
    ])
    expect(step.options[1].description).toBe("A のまま")
    expect(
      attemptResponsesForDecision(step, {
        kind: "option",
        optionKey: step.options[0].key,
      })
    ).toEqual([
      {
        attemptId: "check-differ",
        choice: "rescore",
        status: "evaluated",
        partialScore: null,
        scaleLevelId: LEVEL_B,
      },
    ])
  })

  it("同じ答えに違う類型の組は、類型ごとの「すべて A」で揃える", () => {
    const ownLevels: Record<string, string> = { a: LEVEL_A, b: LEVEL_B }
    const [state] = buildCheckQuestioning({
      checkRun: makeRun({
        attempts: [
          checkAttempt("a", "葉緑体", LEVEL_A),
          checkAttempt("b", "葉緑体", LEVEL_A),
        ],
      }),
      ownScoreOf: (examStudentId) => levelScore(ownLevels[examStudentId]),
      points: 10,
      scaleLevels: SCALE_LEVELS,
    })
    expect(state.step.kind).toBe("sameAnswer")
    expect(state.step.options.map((option) => option.label)).toEqual([
      "すべて A",
      "すべて B",
      "このままにする",
    ])
    // 答案ごとの答えの類型がそろっていなければ、その選択肢として読まない
    const rows = attemptResponsesForDecision(state.step, {
      kind: "option",
      optionKey: state.step.options[0].key,
    })
    const responseOf = (row: (typeof rows)[number], scaleLevelId: string) => ({
      id: `response-${row.attemptId}`,
      ...row,
      scaleLevelId,
      committedAt: null,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    })
    const mixed = decisionFromAttemptResponses(state.step, (attemptId) => {
      const row = rows.find((candidate) => candidate.attemptId === attemptId)
      if (!row) return undefined
      return responseOf(row, attemptId === "check-a" ? LEVEL_A : LEVEL_B)
    })
    expect(mixed.decision).toBeNull()
  })
})
