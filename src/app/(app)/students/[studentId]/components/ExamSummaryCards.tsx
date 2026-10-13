"use client"

import { ChartColumn, FileCheck, TrendingUp } from "lucide-react"
import { useMemo } from "react"

import { SummaryStatCard } from "@/components/common/SummaryStatCard"
import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

interface ExamSummaryCardsProps {
  results: StudentExamResult[]
}

export function ExamSummaryCards({ results }: ExamSummaryCardsProps) {
  const stats = useMemo(() => {
    const scored = results.filter(
      (examResult) =>
        examResult.status === "complete" || examResult.status === "partial"
    )
    if (scored.length === 0) {
      return { examCount: results.length, avgRate: null, maxRate: null }
    }

    const rates = scored.map((examResult) =>
      examResult.maxScore > 0
        ? (examResult.totalScore / examResult.maxScore) * 100
        : 0
    )
    const avgRate = Math.round(
      rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    )
    const maxRate = Math.round(Math.max(...rates))

    return { examCount: results.length, avgRate, maxRate }
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
