/**
 * 使用トークンのタブの集計（月・試験・モデルごと）。行と単価は作り物。
 */

import { describe, expect, it } from "vitest"

import type { MyAiGradingRunRow } from "@/app/(app)/ai-grading/types"
import {
  monthKeyOf,
  summarizeMonthlyUsage,
  summarizeUsageByExam,
  summarizeUsageByModel,
} from "@/app/(app)/ai-grading/utils/aiUsageBreakdown"
import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"

import {
  makeAttempt,
  makePrompt,
  makeRun,
} from "./helpers/aiGradingRowFixtures"

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z")

const PRICING: AiPricing = {
  modelPrices: [
    {
      provider: "anthropic",
      model: "test-model",
      inputPerMillionUsd: 1,
      outputPerMillionUsd: 1,
      cacheReadPerMillionUsd: 0,
      cacheWrite5mPerMillionUsd: 0,
      cacheWrite1hPerMillionUsd: 0,
    },
  ],
  batchPricePercents: { anthropic: null, openai: null },
}

function makeMyRun(options: {
  id: string
  examId: string
  examName: string
  createdAt: Date
  model?: string
  outputTokens: number
}): MyAiGradingRunRow {
  const { user, prompt, ...runFields } = makeRun({
    id: options.id,
    model: options.model ?? "test-model",
    createdAt: options.createdAt,
    attempts: [
      makeAttempt({
        examStudentId: "es-1",
        outputTokens: options.outputTokens,
      }),
    ],
  })
  return {
    ...runFields,
    prompt: {
      ...makePrompt({ id: prompt.id }),
      cropRegion: {
        id: "crop-region-1",
        examPageId: `page-${options.examId}`,
        label: "1",
        type: "QUESTION_ANSWER",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        points: 1,
        orderIndex: 0,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        examPage: {
          id: `page-${options.examId}`,
          examId: options.examId,
          pageNumber: 1,
          imagePath: "page.png",
          pageSize: "A4",
          createdAt: FIXED_DATE,
          updatedAt: FIXED_DATE,
          exam: {
            id: options.examId,
            examName: options.examName,
            referenceDate: null,
            description: null,
            markerCorrectionEnabled: false,
            anonymousScoringEnforced: false,
            createdAt: FIXED_DATE,
            updatedAt: FIXED_DATE,
          },
        },
      },
    },
  }
}

const RUNS = [
  makeMyRun({
    id: "run-1",
    examId: "exam-a",
    examName: "試験A",
    createdAt: new Date(2026, 7, 10),
    outputTokens: 1_000_000,
  }),
  makeMyRun({
    id: "run-2",
    examId: "exam-b",
    examName: "試験B",
    createdAt: new Date(2026, 9, 5),
    model: "unpriced-model",
    outputTokens: 3_000_000,
  }),
  makeMyRun({
    id: "run-3",
    examId: "exam-a",
    examName: "試験A",
    createdAt: new Date(2026, 9, 20),
    outputTokens: 1_000_000,
  }),
]

describe("使用トークンの集計", () => {
  it("月は端末の暦月で、実行の無い月も 0 で並べる", () => {
    expect(monthKeyOf(new Date(2026, 0, 31, 23, 59))).toBe("2026-01")
    const monthlyUsages = summarizeMonthlyUsage(RUNS, PRICING)
    expect(monthlyUsages.map((monthlyUsage) => monthlyUsage.monthKey)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ])
    expect(monthlyUsages[1]).toMatchObject({ runCount: 0, pricedUsd: 0 })
    expect(monthlyUsages[2].runCount).toBe(2)
    expect(monthlyUsages[2].pricedUsd).toBeCloseTo(1)
    expect(monthlyUsages[2].usage.outputTokens).toBe(4_000_000)
    expect(monthlyUsages[2].unpriced.map((unpriced) => unpriced.model)).toEqual(
      ["unpriced-model"]
    )
  })

  it("試験ごと・モデルごとに、使用トークンの多い順に分ける", () => {
    const examUsages = summarizeUsageByExam(RUNS, PRICING)
    expect(
      examUsages.map((examUsage) => [
        examUsage.exam.examName,
        examUsage.runCount,
        examUsage.usage.outputTokens,
      ])
    ).toEqual([
      ["試験B", 1, 3_000_000],
      ["試験A", 2, 2_000_000],
    ])
    expect(examUsages[1].pricedUsd).toBeCloseTo(2)

    const modelUsages = summarizeUsageByModel(RUNS, PRICING)
    expect(
      modelUsages.map((modelUsage) => [
        modelUsage.model,
        modelUsage.runCount,
        modelUsage.unpriced.length,
      ])
    ).toEqual([
      ["unpriced-model", 1, 1],
      ["test-model", 2, 0],
    ])
  })
})
