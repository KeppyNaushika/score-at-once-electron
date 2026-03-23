"use client"

import { BarChart3, TrendingUp, Users } from "lucide-react"
import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import type { ClassStudentResult } from "../hooks/useClassExamResults"

interface ClassSummaryCardsProps {
  studentResults: ClassStudentResult[]
}

export function ClassSummaryCards({ studentResults }: ClassSummaryCardsProps) {
  const stats = useMemo(() => {
    // 全生徒×全試験の得点率を収集
    const allRates: number[] = []
    for (const sr of studentResults) {
      const scored = sr.examResults.filter(
        (r) => r.status === "complete" || r.status === "partial"
      )
      if (scored.length > 0) {
        for (const r of scored) {
          if (r.maxScore > 0) {
            allRates.push((r.totalScore / r.maxScore) * 100)
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

    const avg = allRates.reduce((a, b) => a + b, 0) / allRates.length
    const variance =
      allRates.reduce((sum, r) => sum + (r - avg) ** 2, 0) / allRates.length
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
          <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            在籍生徒数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">
            {stats.studentCount}
            <span className="text-muted-foreground ml-1 text-lg font-normal">
              名
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            学級平均得点率
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">
            {stats.avgRate != null ? (
              <>
                {stats.avgRate}
                <span className="text-muted-foreground ml-1 text-lg font-normal">
                  %
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-lg font-normal">
                —
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            標準偏差
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">
            {stats.stdDev != null ? (
              <>
                {stats.stdDev}
                <span className="text-muted-foreground ml-1 text-lg font-normal">
                  pt
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-lg font-normal">
                —
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
