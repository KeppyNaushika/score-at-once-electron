"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClipboardList } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface ExamResult {
  projectId: string
  examName: string
  examDate: Date | null
  subject: string | null
  totalScore: number
  maxScore: number
  scoredCount: number
  totalQuestions: number
  status: "complete" | "partial" | "unscored"
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

  const formatDate = (date: Date | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("ja-JP")
  }

  const getStatusBadge = (result: ExamResult) => {
    if (result.status === "complete") {
      return <Badge className="bg-green-500">採点完了</Badge>
    } else if (result.status === "partial") {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
          採点中 ({result.scoredCount}/{result.totalQuestions})
        </Badge>
      )
    }
    return <Badge variant="secondary">未採点</Badge>
  }

  const getScoreDisplay = (result: ExamResult) => {
    if (result.status === "unscored") {
      return <span className="text-muted-foreground">-</span>
    }
    const percentage =
      result.maxScore > 0
        ? Math.round((result.totalScore / result.maxScore) * 100)
        : 0
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium">
          {result.totalScore} / {result.maxScore}
        </span>
        <span className="text-muted-foreground text-sm">({percentage}%)</span>
      </div>
    )
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            試験成績
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-4 text-center">
            読み込み中...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          試験成績 ({results.length}件)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {results.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>試験名</TableHead>
                  <TableHead>教科</TableHead>
                  <TableHead>実施日</TableHead>
                  <TableHead>得点</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow
                    key={result.projectId}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/projects/${result.projectId}/07-score-at-once`
                      )
                    }
                  >
                    <TableCell className="font-medium">
                      {result.examName}
                    </TableCell>
                    <TableCell>{result.subject || "-"}</TableCell>
                    <TableCell>{formatDate(result.examDate)}</TableCell>
                    <TableCell>{getScoreDisplay(result)}</TableCell>
                    <TableCell>{getStatusBadge(result)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            <ClipboardList className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>試験の記録がありません</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
