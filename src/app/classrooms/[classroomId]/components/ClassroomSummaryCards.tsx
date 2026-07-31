"use client"

import { BarChart3, TrendingUp, Users } from "lucide-react"
import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" />
            在籍生徒数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">
            {stats.studentCount}
            <span className="ml-1 text-lg font-normal text-muted-foreground">
              名
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            学級平均得点率
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">
            {stats.avgRate != null ? (
              <>
                {stats.avgRate}
                <span className="ml-1 text-lg font-normal text-muted-foreground">
                  %
                </span>
              </>
            ) : (
              <span className="text-lg font-normal text-muted-foreground">
                —
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            標準偏差
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">
            {stats.stdDev != null ? (
              <>
                {stats.stdDev}
                <span className="ml-1 text-lg font-normal text-muted-foreground">
                  pt
                </span>
              </>
            ) : (
              <span className="text-lg font-normal text-muted-foreground">
                —
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
