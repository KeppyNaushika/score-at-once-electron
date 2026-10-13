"use client"

import { ArrowDown, ArrowUp, TrendingUpDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import {
  type ColumnHeadDefinition,
  SortableColumnHeads,
} from "@/components/common/SortableColumnHeads"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ClassroomStudentExamResult } from "@/electron-src/lib/prisma/student"
import { useTableSort } from "@/hooks/useTableSort"

import { computeStudentInsights, type StudentInsight } from "./studentInsights"

// ── 型定義 ──

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

function formatSlope(slope: number | null): string {
  if (slope === null) return "—"
  const sign = slope > 0 ? "+" : ""
  return `${sign}${slope.toFixed(1)}pt/回`
}

function formatRate(rate: number | null): string {
  if (rate === null) return "—"
  return `${rate.toFixed(1)}%`
}

const INSIGHT_COLUMNS: ColumnHeadDefinition<keyof InsightSortable>[] = [
  { label: "番号", sortKey: "attendanceNumber", className: "w-16" },
  { label: "生徒名", sortKey: "studentName" },
  { label: "試験数", sortKey: "examCount", className: "w-20 text-right" },
  { label: "平均", sortKey: "avgRate", className: "w-24 text-right" },
  { label: "変化率", sortKey: "slope", className: "w-28 text-right" },
  { label: "傾向", className: "w-20 text-center" },
]

// ── コンポーネント ──

interface StudentInsightsCardProps {
  studentResults: ClassroomStudentExamResult[]
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
  const insights = useMemo(
    () =>
      computeStudentInsights(studentResults, {
        selectedTags,
        fromTime: dateFrom ? new Date(dateFrom).getTime() : null,
        toTime: dateTo ? new Date(dateTo).getTime() : null,
      }),
    [studentResults, selectedTags, dateFrom, dateTo]
  )

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
    <Card className="mb-8 border-border/50 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUpDown className="h-5 w-5" />
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
              <span className="text-xs text-muted-foreground">タグ:</span>
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
            <span className="text-xs text-muted-foreground">期間:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-7 w-32 rounded px-2 text-xs"
            />
            <span className="text-xs text-muted-foreground">〜</span>
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
          <div className="overflow-hidden rounded-xl border border-border/50">
            <Table>
              <TableHeader className="bg-card">
                <TableRow className="hover:bg-transparent">
                  <SortableColumnHeads
                    columns={INSIGHT_COLUMNS}
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={requestSort}
                  />
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
                    <TableCell className="text-right text-muted-foreground tabular-nums">
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
                        <span className="text-xs text-muted-foreground">
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
          <div className="py-8 text-center text-sm text-muted-foreground">
            表示条件に一致する採点済みの試験がありません
          </div>
        )}
      </CardContent>
    </Card>
  )
}
