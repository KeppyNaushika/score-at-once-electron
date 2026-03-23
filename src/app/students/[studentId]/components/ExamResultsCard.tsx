"use client"

import { ClipboardList } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

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
import { useTableSort } from "@/hooks/useTableSort"

interface ExamResult {
  examId: string
  examName: string
  examDate: Date | null
  tags: string[]
  totalScore: number
  maxScore: number
  scoredCount: number
  totalQuestions: number
  status: "complete" | "partial" | "unscored"
}

interface ExamResultSortable {
  examId: string
  examName: string
  tags: string[]
  examDate: string | null
  totalScore: number
  original: ExamResult
}

interface ExamResultsCardProps {
  studentId: string
}

export function ExamResultsCard({ studentId }: ExamResultsCardProps) {
  const router = useRouter()
  const [results, setResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const data = await window.electronAPI.getStudentExamResults(studentId)
        setResults(data)
      } catch (error) {
        console.error("Failed to fetch exam results:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [studentId])

  // ソート用のデータ変換
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

  // ソート機能
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "examDate", direction: "desc" },
  })

  const formatDate = (date: Date | null) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("ja-JP")
  }

  const getStatusBadge = (result: ExamResult) => {
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

  const getScoreDisplay = (result: ExamResult) => {
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
        <span className="text-muted-foreground text-sm tabular-nums">
          ({percentage}%)
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="border-border/50 mb-8 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            試験成績
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            読み込み中...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 mb-8 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          試験成績
          <span className="text-muted-foreground ml-1 text-lg font-normal tabular-nums">
            ({results.length}件)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedData.length > 0 ? (
          <div className="border-border/50 overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-muted/40">
                  <SortableTableHead
                    sortKey="examName"
                    currentSortKey={sortConfig.key as string | null}
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
                    currentSortKey={sortConfig.key as string | null}
                    currentDirection={sortConfig.direction}
                    onSort={(key) =>
                      requestSort(key as keyof ExamResultSortable)
                    }
                  >
                    実施日
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="totalScore"
                    currentSortKey={sortConfig.key as string | null}
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
          <div className="text-muted-foreground py-12 text-center">
            <ClipboardList className="mx-auto mb-3 h-12 w-12 opacity-30" />
            <p>試験の記録がありません</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
