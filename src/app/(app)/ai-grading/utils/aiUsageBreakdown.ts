/**
 * 使用トークンのタブの集計（すべての試験の、自分の実行）。
 *
 * main は実行の行（試行と、どの試験か）をそのまま返し、月・試験・モデルごとの足し算と
 * 金額はここで求める。金額は利用者が入れた単価で `summarizeRunCosts` が求め、単価の無い
 * 実行は金額に入れない（使用量には入れる）。
 */

import type { AiPricing } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import {
  type RunCostSummary,
  summarizeRunCosts,
  totalTokenCount,
} from "@/lib/aiUsageCost"

import type { MyAiGradingRunRow } from "../types"

/** 実行の行が持つ試験 */
export type RunExam =
  MyAiGradingRunRow["prompt"]["cropRegion"]["examPage"]["exam"]

/** 月1つぶん */
export interface MonthlyUsage extends RunCostSummary {
  /** "2026-10" の形（端末の時刻の暦月） */
  monthKey: string
  runCount: number
}

/** 試験1つぶん */
export interface ExamUsage extends RunCostSummary {
  exam: RunExam
  runCount: number
}

/** 事業者・モデル1つぶん */
export interface ModelUsage extends RunCostSummary {
  provider: string
  model: string
  runCount: number
}

/** 実行を送った月（端末の時刻の暦月）を "2026-10" の形で */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** "2026-10" の次の月 */
function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number)
  return monthKeyOf(new Date(year, month, 1))
}

/** 実行をキーで分ける（最初に現れた順） */
function groupRuns(
  runs: readonly MyAiGradingRunRow[],
  keyOf: (run: MyAiGradingRunRow) => string
): Map<string, MyAiGradingRunRow[]> {
  return runs.reduce((acc, run) => {
    const key = keyOf(run)
    acc.set(key, [...(acc.get(key) ?? []), run])
    return acc
  }, new Map<string, MyAiGradingRunRow[]>())
}

/**
 * 月ごとの使用量と金額（古い順）。最初の月から最後の月までの間で、実行の無い月も 0 で並べる
 * （グラフの横軸を詰めない）
 */
export function summarizeMonthlyUsage(
  runs: readonly MyAiGradingRunRow[],
  pricing: AiPricing
): MonthlyUsage[] {
  const runsByMonth = groupRuns(runs, (run) => monthKeyOf(run.createdAt))
  const monthKeys = [...runsByMonth.keys()].sort()
  if (monthKeys.length === 0) return []
  const lastMonthKey = monthKeys[monthKeys.length - 1]
  const allMonthKeys = [monthKeys[0]]
  while (allMonthKeys[allMonthKeys.length - 1] !== lastMonthKey) {
    allMonthKeys.push(nextMonthKey(allMonthKeys[allMonthKeys.length - 1]))
  }
  return allMonthKeys.map((monthKey) => {
    const monthRuns = runsByMonth.get(monthKey) ?? []
    return {
      monthKey,
      runCount: monthRuns.length,
      ...summarizeRunCosts(monthRuns, pricing),
    }
  })
}

/** 試験ごとの使用量と金額（使用トークンの多い順） */
export function summarizeUsageByExam(
  runs: readonly MyAiGradingRunRow[],
  pricing: AiPricing
): ExamUsage[] {
  return [
    ...groupRuns(
      runs,
      (run) => run.prompt.cropRegion.examPage.exam.id
    ).values(),
  ]
    .map((examRuns) => ({
      exam: examRuns[0].prompt.cropRegion.examPage.exam,
      runCount: examRuns.length,
      ...summarizeRunCosts(examRuns, pricing),
    }))
    .sort((examUsageA, examUsageB) => compareByTokens(examUsageA, examUsageB))
}

/** 事業者・モデルごとの使用量と金額（使用トークンの多い順） */
export function summarizeUsageByModel(
  runs: readonly MyAiGradingRunRow[],
  pricing: AiPricing
): ModelUsage[] {
  return [
    ...groupRuns(runs, (run) =>
      JSON.stringify([run.provider, run.model])
    ).values(),
  ]
    .map((modelRuns) => ({
      provider: modelRuns[0].provider,
      model: modelRuns[0].model,
      runCount: modelRuns.length,
      ...summarizeRunCosts(modelRuns, pricing),
    }))
    .sort((modelUsageA, modelUsageB) =>
      compareByTokens(modelUsageA, modelUsageB)
    )
}

/** 使用トークンの多い順に並べる比較 */
function compareByTokens(
  summaryA: RunCostSummary,
  summaryB: RunCostSummary
): number {
  return totalTokenCount(summaryB.usage) - totalTokenCount(summaryA.usage)
}
