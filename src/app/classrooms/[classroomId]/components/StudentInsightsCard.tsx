"use client"

import { ArrowDown, ArrowUp, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTableSort } from "@/hooks/useTableSort"

import type {
  ClassroomStudentResult,
  ExamResult,
} from "../hooks/useClassroomExamResults"

// ── 型定義 ──

interface StudentInsight {
  studentId: string
  studentName: string
  studentNumber: string
  attendanceNumber: number | null
  avgRate: number | null
  slope: number | null
  trend: "up" | "down" | "stable" | "insufficient"
  examCount: number
}

interface InsightSortable {
  id: string
  attendanceNumber: number | null
  studentName: string
  examCount: number
  avgRate: number | null
  slope: number | null
  original: StudentInsight
}

// ── ヘルパー ──

function calcSlope(values: number[]): number | null {
  const pointCount = values.length
  if (pointCount < 2) return null

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < pointCount; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
  }

  const denom = pointCount * sumX2 - sumX * sumX
  if (denom === 0) return 0
  return (pointCount * sumXY - sumX * sumY) / denom
}

function formatSlope(slope: number | null): string {
  if (slope === null) return "—"
  const sign = slope > 0 ? "+" : ""
  return `${sign}${slope.toFixed(1)}pt/回`
}

function formatRate(rate: number | null): string {
  if (rate === null) return "—"
  return `${rate.toFixed(1)}%`
}

const SLOPE_THRESHOLD = 1.5

// ── コンポーネント ──

interface StudentInsightsCardProps {
  studentResults: ClassroomStudentResult[]
}

export function StudentInsightsCard({
  studentResults,
}: StudentInsightsCardProps) {
  const router = useRouter()
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    studentResults.forEach((studentResult) =>
      studentResult.examResults.forEach((examResult) =>
        examResult.tags.forEach((tag) => tagSet.add(tag))
      )
    )
    return Array.from(tagSet).sort()
  }, [studentResults])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  // フィルタ + 分析
  const insights = useMemo<StudentInsight[]>(() => {
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null
    const toTime = dateTo ? new Date(dateTo).getTime() : null

    const filterExams = (exams: ExamResult[]) =>
      exams.filter((examResult) => {
        if (!examResult.examDate || examResult.maxScore === 0) return false
        if (examResult.status !== "complete" && examResult.status !== "partial")
          return false
        if (
          selectedTags.size > 0 &&
          !examResult.tags.some((tag) => selectedTags.has(tag))
        )
          return false
        const time = new Date(examResult.examDate).getTime()
        if (fromTime && time < fromTime) return false
        if (toTime && time > toTime) return false
        return true
      })

    return studentResults.map((studentResult) => {
      const filtered = filterExams(studentResult.examResults).sort(
        (examA, examB) =>
          new Date(examA.examDate!).getTime() -
          new Date(examB.examDate!).getTime()
      )

      const rates = filtered.map(
        (examResult) => (examResult.totalScore / examResult.maxScore) * 100
      )

      if (rates.length === 0) {
        return {
          studentId: studentResult.studentId,
          studentName: studentResult.studentName,
          studentNumber: studentResult.studentNumber,
          attendanceNumber: studentResult.attendanceNumber,
          avgRate: null,
          slope: null,
          trend: "insufficient" as const,
          examCount: 0,
        }
      }

      const avgRate =
        Math.round(
          (rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 10
        ) / 10
      const rawSlope = calcSlope(rates)
      const slope = rawSlope !== null ? Math.round(rawSlope * 10) / 10 : null

      let trend: "up" | "down" | "stable" | "insufficient"
      if (slope === null || rates.length < 2) {
        trend = "insufficient"
      } else if (slope >= SLOPE_THRESHOLD) {
        trend = "up"
      } else if (slope <= -SLOPE_THRESHOLD) {
        trend = "down"
      } else {
        trend = "stable"
      }

      return {
        studentId: studentResult.studentId,
        studentName: studentResult.studentName,
        studentNumber: studentResult.studentNumber,
        attendanceNumber: studentResult.attendanceNumber,
        avgRate,
        slope,
        trend,
        examCount: rates.length,
      }
    })
  }, [studentResults, selectedTags, dateFrom, dateTo])

  // ソート用データ
  const sortableData = useMemo<InsightSortable[]>(
    () =>
      insights
        .filter((insight) => insight.trend !== "insufficient")
        .map((insight) => ({
          id: insight.studentId,
          attendanceNumber: insight.attendanceNumber,
          studentName: insight.studentName,
          examCount: insight.examCount,
          avgRate: insight.avgRate,
          slope: insight.slope,
          original: insight,
        })),
    [insights]
  )

  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "slope", direction: "asc" },
  })

  const downCount = insights.filter(
    (insight) => insight.trend === "down"
  ).length
  const upCount = insights.filter((insight) => insight.trend === "up").length

  if (studentResults.length === 0) return null

  return (
    <Card className="border-border/50 mb-8 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            生徒の様子
          </CardTitle>
          <div className="flex gap-3">
            {downCount > 0 && (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <ArrowDown className="h-3.5 w-3.5" />
                下降 {downCount}名
              </span>
            )}
            {upCount > 0 && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <ArrowUp className="h-3.5 w-3.5" />
                上昇 {upCount}名
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-muted-foreground text-xs">タグ:</span>
              <Badge
                variant={selectedTags.size === 0 ? "default" : "outline"}
                className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                onClick={() => setSelectedTags(new Set())}
              >
                全て
              </Badge>
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.has(tag) ? "default" : "outline"}
                  className="h-5 cursor-pointer rounded-full px-2 text-[10px] font-normal"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs">期間:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-7 w-32 rounded px-2 text-xs"
            />
            <span className="text-muted-foreground text-xs">〜</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-7 w-32 rounded px-2 text-xs"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {sortedData.length > 0 ? (
          <div className="border-border/50 overflow-hidden rounded-xl border">
            <Table>
              <TableHeader className="bg-card">
                <TableRow className="hover:bg-transparent">
                  <SortableTableHead
                    sortKey="attendanceNumber"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) => requestSort(key)}
                    className="w-16"
                  >
                    番号
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="studentName"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) => requestSort(key)}
                  >
                    生徒名
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="examCount"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) => requestSort(key)}
                    className="w-20 text-right"
                  >
                    試験数
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="avgRate"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) => requestSort(key)}
                    className="w-24 text-right"
                  >
                    平均
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="slope"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) => requestSort(key)}
                    className="w-28 text-right"
                  >
                    変化率
                  </SortableTableHead>
                  <TableHead className="w-20 text-center">傾向</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(({ original: insight }) => (
                  <TableRow
                    key={insight.studentId}
                    className="group cursor-pointer"
                    onClick={() =>
                      router.push(`/students/${insight.studentId}`)
                    }
                  >
                    <TableCell className="tabular-nums">
                      {insight.attendanceNumber ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {insight.studentName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {insight.examCount}回
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatRate(insight.avgRate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          insight.slope !== null && insight.slope > 0
                            ? "text-green-600"
                            : insight.slope !== null && insight.slope < 0
                              ? "text-red-600"
                              : "text-muted-foreground"
                        }`}
                      >
                        {formatSlope(insight.slope)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {insight.trend === "up" && (
                        <Badge className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-normal text-green-700">
                          <ArrowUp className="mr-0.5 h-3 w-3" />
                          上昇
                        </Badge>
                      )}
                      {insight.trend === "down" && (
                        <Badge className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-normal text-red-700">
                          <ArrowDown className="mr-0.5 h-3 w-3" />
                          下降
                        </Badge>
                      )}
                      {insight.trend === "stable" && (
                        <span className="text-muted-foreground text-xs">
                          安定
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center text-sm">
            表示条件に一致する採点済みの試験がありません
          </div>
        )}
      </CardContent>
    </Card>
  )
}
