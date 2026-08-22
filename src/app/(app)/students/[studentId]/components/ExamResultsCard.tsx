"use client"

import { ClipboardList } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { StudentExamResult } from "@/electron-src/lib/prisma/student"
import { useTableSort } from "@/hooks/useTableSort"

interface ExamResultSortable {
  examId: string
  examName: string
  tags: string[]
  examDate: string | null
  totalScore: number
  original: StudentExamResult
}

interface ExamResultsCardProps {
  results: StudentExamResult[]
}

export function ExamResultsCard({ results }: ExamResultsCardProps) {
  const router = useRouter()

  const sortableData = useMemo<ExamResultSortable[]>(() => {
    return results.map((result) => ({
      examId: result.examId,
      examName: result.examName,
      tags: result.tags,
      examDate: result.examDate
        ? new Date(result.examDate).toISOString()
        : null,
      totalScore: result.totalScore,
      original: result,
    }))
  }, [results])

  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "examDate", direction: "desc" },
  })

  const formatDate = (date: Date | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("ja-JP")
  }

  const getStatusBadge = (result: StudentExamResult) => {
    if (result.status === "complete") {
      return (
        <Badge className="rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-normal">
          採点完了
        </Badge>
      )
    } else if (result.status === "partial") {
      return (
        <Badge
          variant="outline"
          className="rounded-full border-yellow-500 px-2.5 py-0.5 text-xs font-normal text-yellow-600"
        >
          採点中 ({result.scoredCount}/{result.totalQuestions})
        </Badge>
      )
    }
    return (
      <Badge
        variant="secondary"
        className="rounded-full px-2.5 py-0.5 text-xs font-normal"
      >
        未採点
      </Badge>
    )
  }

  const getScoreDisplay = (result: StudentExamResult) => {
    if (result.status === "unscored") {
      return <span className="text-muted-foreground">—</span>
    }
    const percentage =
      result.maxScore > 0
        ? Math.round((result.totalScore / result.maxScore) * 100)
        : 0
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium tabular-nums">
          {result.totalScore} / {result.maxScore}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          ({percentage}%)
        </span>
      </div>
    )
  }

  return (
    <Card className="mb-8 border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          試験成績一覧
          <span className="ml-1 text-lg font-normal text-muted-foreground tabular-nums">
            ({results.length}件)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedData.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border/50">
            <Table>
              <TableHeader className="bg-card">
                <TableRow className="hover:bg-transparent">
                  <SortableTableHead
                    sortKey="examName"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) =>
                      requestSort(key as keyof ExamResultSortable)
                    }
                  >
                    試験名
                  </SortableTableHead>
                  <TableHead>タグ</TableHead>
                  <SortableTableHead
                    sortKey="examDate"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) =>
                      requestSort(key as keyof ExamResultSortable)
                    }
                  >
                    実施日
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="totalScore"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={(key) =>
                      requestSort(key as keyof ExamResultSortable)
                    }
                  >
                    得点
                  </SortableTableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(({ original: result }) => (
                  <TableRow
                    key={result.examId}
                    className="group cursor-pointer"
                    onClick={() =>
                      router.push(`/exams/${result.examId}/07-score-at-once`)
                    }
                  >
                    <TableCell className="font-medium">
                      {result.examName}
                    </TableCell>
                    <TableCell>
                      {result.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {result.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(result.examDate)}
                    </TableCell>
                    <TableCell>{getScoreDisplay(result)}</TableCell>
                    <TableCell>{getStatusBadge(result)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>試験の記録がありません</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
