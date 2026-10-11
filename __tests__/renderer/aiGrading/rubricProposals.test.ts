/**
 * 2段目の項目の案と問いかけへの答えの純粋な関数（docs/vlm-grading-design.md §3-5・§5-4）と、
 * 2段目の費用の概算（§3-8）。
 *
 * 行・単価・トークン数はすべて作り物。
 */

import { describe, expect, it } from "vitest"

import { estimateGroupingCost } from "@/components/exams/07-score-at-once/AiGrading/utils/groupingCostEstimate"
import {
  type AiRubricProposalRow,
  attemptsOutsideProposals,
  latestEndedProposalRun,
  latestProposalResponse,
  orderMembersByConfidence,
  orderProposalsForQuestioning,
  planProposalAnswer,
  proposalKindOf,
} from "@/components/exams/07-score-at-once/AiGrading/utils/rubricProposals"
import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"

import { makeAttempt } from "./helpers/aiGradingRowFixtures"

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")

type OptionRow = AiRubricProposalRow["options"][number]
type ResponseRow = AiRubricProposalRow["responses"][number]

function makeOption(overrides: Partial<OptionRow> = {}): OptionRow {
  return {
    id: "option-1",
    proposalId: "proposal-1",
    effectKind: "adjust",
    pointDelta: -1,
    setStatus: null,
    setScore: null,
    rationale: "",
    recommended: true,
    sortOrder: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

function makeResponse(overrides: Partial<ResponseRow> = {}): ResponseRow {
  return {
    id: "response-1",
    proposalId: "proposal-1",
    optionId: "option-1",
    freeText: "",
    resultRubricItemId: "item-1",
    committedAt: FIXED_DATE,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    scores: [],
    ...overrides,
  }
}

function makeMember(examStudentId: string, confidence = "high") {
  const attempt = makeAttempt({ examStudentId, confidence })
  return {
    id: `member-${examStudentId}`,
    proposalId: "proposal-1",
    attemptId: attempt.id,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    attempt,
  }
}

function makeProposal(
  overrides: Partial<AiRubricProposalRow> = {}
): AiRubricProposalRow {
  return {
    id: "proposal-1",
    runId: "group-run-1",
    label: "単位が無い",
    description: "",
    adviceDraft: "単位を書こう。",
    matchedRubricItemId: null,
    sortOrder: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    options: [makeOption()],
    members: [makeMember("student-a"), makeMember("student-b")],
    responses: [],
    ...overrides,
  }
}

describe("案の状態と並び", () => {
  it("最新の答えが効く（答え直しは新しい行）", () => {
    expect(latestProposalResponse(makeProposal())).toBeNull()
    const answered = makeProposal({
      responses: [
        makeResponse({ id: "first" }),
        makeResponse({ id: "second", optionId: null, freeText: "指示" }),
      ],
    })
    expect(latestProposalResponse(answered)?.id).toBe("second")
  })

  it("既存の項目に当たる案 → 判定を決める案 → 点を加減する案の順。同じ種類は返ってきた順", () => {
    const adjust = makeProposal({ id: "adjust", sortOrder: 0 })
    const set = makeProposal({
      id: "set",
      sortOrder: 1,
      options: [makeOption({ effectKind: "set", setStatus: "incorrect" })],
    })
    const matched = makeProposal({
      id: "matched",
      sortOrder: 2,
      matchedRubricItemId: "item-1",
    })
    const laterSet = makeProposal({
      id: "later-set",
      sortOrder: 3,
      options: [makeOption({ effectKind: "set", setStatus: "pending" })],
    })
    expect(proposalKindOf(set)).toBe("set")
    expect(
      orderProposalsForQuestioning([adjust, set, matched, laterSet]).map(
        (proposal) => proposal.id
      )
    ).toEqual(["matched", "set", "later-set", "adjust"])
  })

  it("案の中の答案は確信度の低い順", () => {
    const members = [
      makeMember("high", "high"),
      makeMember("low", "low"),
      makeMember("medium", "medium"),
    ]
    expect(
      orderMembersByConfidence(members).map(
        (member) => member.attempt.examStudentId
      )
    ).toEqual(["low", "medium", "high"])
  })

  it("問いかけに使うのは最後に終わった2段目の実行", () => {
    expect(
      latestEndedProposalRun([
        { id: "a", status: "ended" },
        { id: "b", status: "ended" },
        { id: "c", status: "failed" },
      ])?.id
    ).toBe("b")
    expect(latestEndedProposalRun([{ id: "a", status: "failed" }])).toBeNull()
  })

  it("どの案にも入らず、既存の項目にも当たらない正答でない答案を「判断できない」として返す", () => {
    const attempts = [
      makeAttempt({ examStudentId: "in-proposal", status: "incorrect" }),
      makeAttempt({ examStudentId: "correct", status: "correct" }),
      {
        ...makeAttempt({ examStudentId: "matched", status: "incorrect" }),
        rubricMatches: [{ id: "match", attemptId: "x", rubricItemId: "item" }],
      },
      makeAttempt({ examStudentId: "left", status: "incorrect" }),
      makeAttempt({ examStudentId: "failed", state: "errored" }),
    ]
    const proposal = makeProposal({ members: [makeMember("in-proposal")] })
    expect(
      attemptsOutsideProposals(attempts, [proposal]).map(
        (attempt) => attempt.examStudentId
      )
    ).toEqual(["left"])
  })
})

describe("確定で項目に何が起こるか", () => {
  it("main と同じ決め方で返す。前の項目は確定した答えだけから引く", () => {
    const living = new Set(["item-1", "existing"])
    expect(planProposalAnswer(makeProposal(), true, living)).toEqual({
      kind: "create",
    })
    expect(
      planProposalAnswer(
        makeProposal({ matchedRubricItemId: "existing" }),
        true,
        living
      )
    ).toEqual({ kind: "link", rubricItemId: "existing" })
    const answered = makeProposal({ responses: [makeResponse()] })
    expect(planProposalAnswer(answered, true, living)).toEqual({
      kind: "update",
      rubricItemId: "item-1",
    })
    // 前の答えで作った項目が消えていれば、作り直す
    expect(planProposalAnswer(answered, true, new Set())).toEqual({
      kind: "create",
    })
    expect(planProposalAnswer(answered, false, living)).toEqual({
      kind: "unapply",
      unappliedRubricItemId: "item-1",
    })
    // 下書きの答え（まだ確定していない）は項目を持たないので、前の項目にならない
    const drafted = makeProposal({
      responses: [
        makeResponse({ committedAt: null, resultRubricItemId: null }),
      ],
    })
    expect(planProposalAnswer(drafted, true, living)).toEqual({
      kind: "create",
    })
  })
})

describe("2段目の費用の概算", () => {
  const pricing: AiPricing = {
    modelPrices: [
      {
        provider: "anthropic",
        model: "claude-haiku-4-5",
        inputPerMillionUsd: 1,
        outputPerMillionUsd: 5,
        cacheReadPerMillionUsd: 0.1,
        cacheWrite5mPerMillionUsd: 1.25,
        cacheWrite1hPerMillionUsd: 2,
      },
    ],
    batchPricePercents: { anthropic: 50, openai: null },
  }
  const input = {
    provider: "anthropic" as const,
    model: "claude-haiku-4-5",
    effort: "low" as const,
    answerCount: 10,
    promptCharacterCount: 200,
    measuredRuns: [],
  }

  it("実測が無ければ、入力は指示＋欄の字数＋答案ごとの目安、出力は手間ごとの目安で数える", () => {
    const estimate = estimateGroupingCost(input, pricing)
    expect(estimate.usage).toEqual({
      inputTokens: 1800 + 200 + 120 * 10,
      outputTokens: 2000 + 30 * 10,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    expect(estimate.outputBasis).toEqual({ kind: "guideline" })
    expect(estimate.cost.isPriced && estimate.cost.costUsd).toBeCloseTo(
      (3200 * 1 + 2300 * 5) / 1_000_000
    )
  })

  it("同じ事業者・モデル・手間の2段目の実測があれば、出力はその平均。1段目の実行は数えない", () => {
    const usage = { inputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }
    const estimate = estimateGroupingCost(
      {
        ...input,
        measuredRuns: [
          {
            ...usage,
            purpose: "group",
            provider: "anthropic",
            model: "claude-haiku-4-5-20251001",
            effort: "low",
            outputTokens: 3000,
          },
          {
            ...usage,
            purpose: "group",
            provider: "anthropic",
            model: "claude-haiku-4-5",
            effort: "low",
            outputTokens: 5000,
          },
          {
            ...usage,
            purpose: "grade",
            provider: "anthropic",
            model: "claude-haiku-4-5",
            effort: "low",
            outputTokens: 99999,
          },
          {
            ...usage,
            purpose: "group",
            provider: "anthropic",
            model: "claude-haiku-4-5",
            effort: "high",
            outputTokens: 99999,
          },
        ],
      },
      pricing
    )
    expect(estimate.usage.outputTokens).toBe(4000)
    expect(estimate.outputBasis).toEqual({ kind: "measured", sampleCount: 2 })
  })

  it("送る答案が無ければ0", () => {
    expect(
      estimateGroupingCost({ ...input, answerCount: 0 }, pricing).usage
    ).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
  })
})
