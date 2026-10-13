import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

/**
 * 得点率（%、丸めない）。満点が0の試験は 0% とする。
 * 生徒・学級の詳細画面（要約カード・推移）はどれもこの1本で得点率を出す。
 * 丸め（生徒は整数%、学級は小数1桁）は表示の側で行う
 */
export function scoreRatePercent(score: number, maxScore: number): number {
  return maxScore > 0 ? (score / maxScore) * 100 : 0
}

/** 得点率を数える試験か（採点済みか、途中まで採点済み） */
export function isScoredExam(examResult: StudentExamResult): boolean {
  return examResult.status === "complete" || examResult.status === "partial"
}

/** 採点済み（途中を含む）の試験の合計得点率。満点0の試験は 0% として並ぶ */
export function scoredExamRates(examResults: StudentExamResult[]): number[] {
  return examResults
    .filter(isScoredExam)
    .map((examResult) =>
      scoreRatePercent(examResult.totalScore, examResult.maxScore)
    )
}

/** 得点率の平均と標準偏差（母標準偏差、丸めない）。得点率が無ければ null */
export function rateMeanAndStdDev(
  rates: number[]
): { mean: number; stdDev: number } | null {
  if (rates.length === 0) return null
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
  const variance =
    rates.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / rates.length
  return { mean, stdDev: Math.sqrt(variance) }
}
