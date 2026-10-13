"use client"

import { ChartColumn, TrendingUp, Users } from "lucide-react"
import { useMemo } from "react"

import { SummaryStatCard } from "@/components/common/SummaryStatCard"
import {
  rateMeanAndStdDev,
  scoredExamRates,
} from "@/components/score-trend/scoreRate"
import type { ClassroomStudentExamResult } from "@/electron-src/lib/prisma/student"

interface ClassroomSummaryCardsProps {
  studentResults: ClassroomStudentExamResult[]
}

export function ClassroomSummaryCards({
  studentResults,
}: ClassroomSummaryCardsProps) {
  const stats = useMemo(() => {
    // 全生徒×全試験（採点済み・途中を含む）の得点率。満点0の試験は 0% として入れる
    const rateStats = rateMeanAndStdDev(
      studentResults.flatMap((studentResult) =>
        scoredExamRates(studentResult.examResults)
      )
    )
    return {
      studentCount: studentResults.length,
      avgRate: rateStats ? Math.round(rateStats.mean) : null,
      stdDev: rateStats ? Math.round(rateStats.stdDev * 10) / 10 : null,
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
