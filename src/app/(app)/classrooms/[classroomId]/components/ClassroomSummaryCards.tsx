"use client"

import { ChartColumn, TrendingUp, Users } from "lucide-react"
import { useMemo } from "react"

import { SummaryStatCard } from "@/components/common/SummaryStatCard"
import type { ClassroomStudentExamResult } from "@/electron-src/lib/prisma/student"

interface ClassroomSummaryCardsProps {
  studentResults: ClassroomStudentExamResult[]
}

export function ClassroomSummaryCards({
  studentResults,
}: ClassroomSummaryCardsProps) {
  const stats = useMemo(() => {
    // 全生徒×全試験の得点率を収集
    const allRates: number[] = []
    for (const studentResult of studentResults) {
      const scored = studentResult.examResults.filter(
        (examResult) =>
          examResult.status === "complete" || examResult.status === "partial"
      )
      if (scored.length > 0) {
        for (const examResult of scored) {
          if (examResult.maxScore > 0) {
            allRates.push((examResult.totalScore / examResult.maxScore) * 100)
          }
        }
      }
    }

    if (allRates.length === 0) {
      return {
        studentCount: studentResults.length,
        avgRate: null,
        stdDev: null,
      }
    }

    const avg = allRates.reduce((sum, rate) => sum + rate, 0) / allRates.length
    const variance =
      allRates.reduce((sum, rate) => sum + (rate - avg) ** 2, 0) /
      allRates.length
    const stdDev = Math.sqrt(variance)

    return {
      studentCount: studentResults.length,
      avgRate: Math.round(avg),
      stdDev: Math.round(stdDev * 10) / 10,
    }
  }, [studentResults])

  return (
    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
      <SummaryStatCard
        icon={Users}
        title="在籍生徒数"
        value={stats.studentCount}
        unit="名"
      />
      <SummaryStatCard
        icon={ChartColumn}
        title="学級平均得点率"
        value={stats.avgRate}
        unit="%"
      />
      <SummaryStatCard
        icon={TrendingUp}
        title="標準偏差"
        value={stats.stdDev}
        unit="pt"
      />
    </div>
  )
}
