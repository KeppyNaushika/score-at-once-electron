"use client"

import { ChartColumn, FileCheck, TrendingUp } from "lucide-react"
import { useMemo } from "react"

import { SummaryStatCard } from "@/components/common/SummaryStatCard"
import {
  rateMeanAndStdDev,
  scoredExamRates,
} from "@/components/score-trend/scoreRate"
import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

interface ExamSummaryCardsProps {
  results: StudentExamResult[]
}

export function ExamSummaryCards({ results }: ExamSummaryCardsProps) {
  const stats = useMemo(() => {
    // 採点済み（途中を含む）の試験の得点率。満点0の試験は 0% として入れる
    const rates = scoredExamRates(results)
    const rateStats = rateMeanAndStdDev(rates)
    if (!rateStats) {
      return { examCount: results.length, avgRate: null, maxRate: null }
    }
    return {
      examCount: results.length,
      avgRate: Math.round(rateStats.mean),
      maxRate: Math.round(Math.max(...rates)),
    }
  }, [results])

  return (
    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
      <SummaryStatCard
        icon={FileCheck}
        title="受験回数"
        value={stats.examCount}
        unit="回"
      />
      <SummaryStatCard
        icon={ChartColumn}
        title="平均得点率"
        value={stats.avgRate}
        unit="%"
      />
      <SummaryStatCard
        icon={TrendingUp}
        title="最高得点率"
        value={stats.maxRate}
        unit="%"
        valueClassName="text-green-600"
        unitClassName="text-green-600/70"
      />
    </div>
  )
}
