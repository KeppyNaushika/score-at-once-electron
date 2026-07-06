"use client"

import { BarChart3, FileCheck, TrendingUp } from "lucide-react"
import { useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <FileCheck className="h-4 w-4" />
            受験回数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">
            {stats.examCount}
            <span className="text-muted-foreground ml-1 text-lg font-normal">
              回
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            平均得点率
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
            最高得点率
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600 tabular-nums">
            {stats.maxRate != null ? (
              <>
                {stats.maxRate}
                <span className="ml-1 text-lg font-normal text-green-600/70">
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
    </div>
  )
}
