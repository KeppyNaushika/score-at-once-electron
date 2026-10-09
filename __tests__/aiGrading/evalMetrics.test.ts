/**
 * プロンプトの評価の仕組み（scripts/aiGradingEval）の純粋な部分。入力はすべて合成データ。
 *
 * - 比べる相手の決め方（確定 > 合意 > 割れ）
 * - 1段目・2段目の指標と、項目を送った1段目の当てはまりの指標
 * - CLI の stream-json の出力の読み取り
 */

import { describe, expect, it } from "vitest"

import { parseStreamJsonOutput } from "../../scripts/aiGradingEval/claudeCli"
import { resolveReferenceScore } from "../../scripts/aiGradingEval/referenceScore"
import { computeRubricMatchMetrics } from "../../scripts/aiGradingEval/rubricMatchMetrics"
import {
  computeStage1Metrics,
  type Stage1EvalRecord,
} from "../../scripts/aiGradingEval/stage1Metrics"
import { computeStage2Metrics } from "../../scripts/aiGradingEval/stage2Metrics"

const teacher = (status: string, partialScore: number | null = null) => ({
  userId: `user-${status}-${partialScore}`,
  status,
  partialScore,
})

describe("比べる相手の決め方", () => {
  it("確定があれば確定を採る", () => {
    const reference = resolveReferenceScore(
      {
        teacherScores: [teacher("correct"), teacher("incorrect")],
        decision: { status: "incorrect", score: null },
      },
      3
    )
    expect(reference).toEqual({
      kind: "decided",
      verdict: { status: "incorrect", score: 0 },
    })
  })

  it("全員一致なら合意、食い違えば割れ、unscored は数えない", () => {
    expect(
      resolveReferenceScore(
        {
          teacherScores: [teacher("correct"), teacher("unscored")],
          decision: null,
        },
        3
      ).kind
    ).toBe("agreed")
    const disputed = resolveReferenceScore(
      {
        teacherScores: [teacher("partial", 1), teacher("partial", 2)],
        decision: null,
      },
      3
    )
    expect(disputed.kind).toBe("disputed")
    expect(
      resolveReferenceScore(
        { teacherScores: [teacher("unscored")], decision: null },
        3
      ).kind
    ).toBe("none")
  })
})

const record = (override: Partial<Stage1EvalRecord>): Stage1EvalRecord => ({
  cropRegionId: "region",
  examStudentId: "student",
  label: "1-1",
  points: 4,
  cliOk: true,
  errorText: "",
  verdict: {
    ok: true,
    status: "correct",
    partialScore: null,
    confidence: "high",
    transcription: "",
    observation: "",
  },
  reference: { kind: "agreed", verdict: { status: "correct", score: 4 } },
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    thinkingTokens: 0,
  },
  costUsd: 0.01,
  wallMs: 1000,
  ...override,
})

describe("1段目の指標", () => {
  it("一致率・±1点・確信度別・割れ・形の守り具合を数える", () => {
    const metrics = computeStage1Metrics([
      record({}),
      record({
        verdict: {
          ok: true,
          status: "partial",
          partialScore: 3,
          confidence: "low",
          transcription: "",
          observation: "答案は単位が無い。誤答とした。",
        },
      }),
      record({ verdict: { ok: false, reasons: ["形"] } }),
      record({ cliOk: false, verdict: null }),
      record({
        reference: {
          kind: "disputed",
          candidates: [
            { status: "incorrect", score: 0 },
            { status: "correct", score: 4 },
          ],
        },
      }),
    ])
    expect(metrics.total).toBe(5)
    expect(metrics.cliFailures).toBe(1)
    expect(metrics.shapeOkRate).toBe(3 / 4)
    expect(metrics.compared).toBe(2)
    expect(metrics.statusMatchRate).toBe(0.5)
    expect(metrics.scoreMatchRate).toBe(0.5)
    expect(metrics.withinOneRate).toBe(1)
    expect(metrics.byConfidence.low).toEqual({ n: 1, matched: 0 })
    expect(metrics.disputed).toEqual({ n: 1, matched: 1 })
    expect(metrics.confusion.correct).toEqual({ correct: 1, partial: 1 })
    expect(metrics.observationVerdictMentions).toBe(1)
  })
})

describe("2段目の指標", () => {
  it("案の数・取りこぼし・純度・同じ読み取りの同居・推奨の一致を数える", () => {
    const metrics = computeStage2Metrics({
      answers: [
        {
          answerKey: "A1",
          referenceStatus: "incorrect",
          aiStatus: "incorrect",
          transcription: "5 0",
        },
        {
          answerKey: "A2",
          referenceStatus: "incorrect",
          aiStatus: "incorrect",
          transcription: "50",
        },
        {
          answerKey: "A3",
          referenceStatus: "correct",
          aiStatus: "incorrect",
          transcription: "50cm",
        },
        {
          answerKey: "A4",
          referenceStatus: "no_answer",
          aiStatus: "no_answer",
          transcription: "",
        },
      ],
      proposals: [
        {
          memberAnswerKeys: ["A1", "A2", "A3"],
          recommendedSetStatus: "incorrect",
        },
        { memberAnswerKeys: ["A3"], recommendedSetStatus: null },
      ],
      uncoveredAnswerKeys: ["A4"],
    })
    expect(metrics.proposalCount).toBe(2)
    expect(metrics.uncoveredCount).toBe(1)
    expect(metrics.outsideAnyProposalCount).toBe(1)
    expect(metrics.multiMembershipCount).toBe(1)
    expect(metrics.purity).toBe(3 / 4)
    expect(metrics.sameTranscriptionGroups).toBe(1)
    expect(metrics.sameTranscriptionCohesion).toBe(1)
    expect(metrics.recommendedMatchRate).toBe(1)
  })
})

describe("CLI の出力の読み取り", () => {
  it("最後の result から構造化出力・使用量・費用を、rate_limit_event から使用率を読む", () => {
    const stdout = [
      JSON.stringify({ type: "system", subtype: "init" }),
      JSON.stringify({
        type: "rate_limit_event",
        rate_limit_info: {
          unifiedWindows: {
            five_hour: { utilization: 0.1 },
            seven_day: { utilization: 0.5 },
          },
        },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        structured_output: { status: "correct" },
        usage: {
          input_tokens: 2,
          output_tokens: 30,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 50,
          output_tokens_details: { thinking_tokens: 7 },
        },
        total_cost_usd: 0.002,
        duration_api_ms: 1500,
        num_turns: 2,
      }),
    ].join("\n")
    const parsed = parseStreamJsonOutput(stdout)
    expect(parsed.ok).toBe(true)
    expect(parsed.structuredOutput).toEqual({ status: "correct" })
    expect(parsed.usage).toEqual({
      inputTokens: 2,
      outputTokens: 30,
      cacheReadTokens: 100,
      cacheWriteTokens: 50,
      thinkingTokens: 7,
    })
    expect(parsed.rateLimitUtilization).toEqual({
      fiveHour: 0.1,
      sevenDay: 0.5,
    })
  })

  it("result が無い・構造化出力が無いときは失敗にする", () => {
    expect(parseStreamJsonOutput("").ok).toBe(false)
    expect(
      parseStreamJsonOutput(
        JSON.stringify({ type: "result", is_error: false, result: "text" })
      ).ok
    ).toBe(false)
  })
})

describe("項目を送った1段目の当てはまりの指標", () => {
  const items = [
    {
      id: "item-correct",
      label: "模範解答どおり",
      effectKind: "set" as const,
      pointDelta: null,
      setStatus: "correct" as const,
      setScore: null,
    },
    {
      id: "item-unit",
      label: "単位が無い",
      effectKind: "adjust" as const,
      pointDelta: -1,
      setStatus: null,
      setScore: null,
    },
    {
      id: "item-wrong",
      label: "別の語",
      effectKind: "set" as const,
      pointDelta: null,
      setStatus: "incorrect" as const,
      setScore: null,
    },
  ]

  it("2段目との一致・適合率・再現率と、項目から計算した判定の教員との一致を数える", () => {
    const metrics = computeRubricMatchMetrics([
      {
        points: 2,
        items,
        cells: [
          // 一致。正答
          {
            matchedItemIds: ["item-correct"],
            expectedItemIds: ["item-correct"],
            aiStatus: "correct",
            referenceStatus: "correct",
          },
          // 2段目は単位なしのみ、1段目は単位なし＋別の語（判定は誤答。教員は部分点）
          {
            matchedItemIds: ["item-unit", "item-wrong"],
            expectedItemIds: ["item-unit"],
            aiStatus: "incorrect",
            referenceStatus: "partial",
          },
          // 1段目が何も返さない（未採点。教員は誤答）
          {
            matchedItemIds: [],
            expectedItemIds: ["item-wrong"],
            aiStatus: "incorrect",
            referenceStatus: "incorrect",
          },
          // 判定を決める項目が2つ。教員の判定が割れたマスは判定の比較から外す
          {
            matchedItemIds: ["item-correct", "item-wrong"],
            expectedItemIds: ["item-correct"],
            aiStatus: "correct",
            referenceStatus: null,
          },
        ],
      },
    ])
    expect(metrics.cells).toBe(4)
    expect(metrics.exactMatch).toEqual({ n: 4, matched: 1, rate: 0.25 })
    expect(metrics.precision).toEqual({ n: 5, matched: 3, rate: 0.6 })
    expect(metrics.recall).toEqual({ n: 4, matched: 3, rate: 0.75 })
    expect(metrics.noMatchCount).toBe(1)
    expect(metrics.multipleSetCount).toBe(1)
    // 項目からの判定: 正答○ / 誤答×（教員は部分点）/ 未採点×
    expect(metrics.statusFromMatched).toEqual({
      n: 3,
      matched: 1,
      rate: 1 / 3,
    })
    // 2段目の案のまま: 正答○ / 単位なしで 2−1=1点の部分点○ / 誤答○
    expect(metrics.statusFromExpected).toEqual({ n: 3, matched: 3, rate: 1 })
    expect(metrics.statusFromAi).toEqual({ n: 3, matched: 2, rate: 2 / 3 })
  })
})
