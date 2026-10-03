"use client"

import { BarChart3, ChevronRight, Lock } from "lucide-react"

import type { useStudentGradeResults } from "@/app/(app)/students/[studentId]/hooks/useStudentGradeResults"
import { GuardedLink } from "@/components/common/GuardedLink"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type StudentGradeResults = ReturnType<
  typeof useStudentGradeResults
>["gradeResults"]

interface GradeResultsCardProps {
  gradeResults: StudentGradeResults
  loading: boolean
}

function formatPercentage(percentage: number | null): string {
  return percentage === null ? "—" : `${percentage.toFixed(1)}%`
}

function formatScore(score: number | null, maxScore: number): string {
  if (score === null) return "—"
  return `${Math.round(score * 10) / 10} / ${Math.round(maxScore * 10) / 10}`
}

function formatDate(date: Date | null): string {
  return date ? new Date(date).toLocaleDateString("ja-JP") : "日付なし"
}

/**
 * 生徒が載っている成績算出ごとの、評価項目の結果。
 *
 * 値は 05-results と同じ実効値（確定値 > 上書き > 算出値）。確定・上書き・除外は
 * 札で添える。成績算出日の新しい順に並べる。
 */
export function GradeResultsCard({
  gradeResults,
  loading,
}: GradeResultsCardProps) {
  const sortedGradeResults = gradeResults.toSorted(
    (gradeResultA, gradeResultB) =>
      new Date(gradeResultB.gradeStudent.grade.referenceDate ?? 0).getTime() -
      new Date(gradeResultA.gradeStudent.grade.referenceDate ?? 0).getTime()
  )

  return (
    <Card className="mb-8 border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          成績算出
          <span className="ml-1 text-lg font-normal text-muted-foreground tabular-nums">
            ({gradeResults.length}件)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="size-5" />
          </div>
        ) : sortedGradeResults.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            この生徒が載っている成績算出はありません
          </p>
        ) : (
          sortedGradeResults.map(
            ({
              gradeStudent,
              calculationResult,
              studentResult,
              loading: resultLoading,
            }) => (
              <section key={gradeStudent.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <GuardedLink
                    href={`/grades/${gradeStudent.gradeId}/05-results`}
                    className="flex items-center gap-1 font-medium hover:underline"
                  >
                    {gradeStudent.grade.name}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </GuardedLink>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatDate(gradeStudent.grade.referenceDate)}
                  </span>
                </div>
                {resultLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="size-4" />
                  </div>
                ) : studentResult === null || calculationResult === null ? (
                  <p className="text-sm text-muted-foreground">
                    算出結果を読み込めませんでした
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border/50">
                    <Table>
                      <TableHeader className="bg-card">
                        <TableRow className="hover:bg-transparent">
                          <TableHead>評価項目</TableHead>
                          <TableHead className="w-28">評価</TableHead>
                          <TableHead className="w-36">得点</TableHead>
                          <TableHead className="w-24">得点率</TableHead>
                          <TableHead className="w-40" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentResult.gradeItemResults.map(
                          (gradeItemResult) => (
                            <TableRow key={gradeItemResult.gradeItemId}>
                              <TableCell className="font-medium">
                                {gradeItemResult.gradeItemName}
                              </TableCell>
                              <TableCell>
                                {gradeItemResult.isExcluded ? (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                ) : gradeItemResult.gradeLabel ? (
                                  <Badge
                                    variant="secondary"
                                    className="rounded-full px-2.5 py-0.5 text-sm"
                                  >
                                    {gradeItemResult.gradeLabel}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {gradeItemResult.isExcluded
                                  ? "—"
                                  : formatScore(
                                      gradeItemResult.weightedScore,
                                      gradeItemResult.weightedMaxScore
                                    )}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {gradeItemResult.isExcluded
                                  ? "—"
                                  : formatPercentage(
                                      gradeItemResult.percentage
                                    )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {gradeItemResult.isExcluded && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      除外
                                    </Badge>
                                  )}
                                  {gradeItemResult.frozen && (
                                    <Badge
                                      variant="outline"
                                      className="gap-1 text-xs"
                                    >
                                      <Lock className="h-3 w-3" />
                                      確定
                                      {gradeItemResult.frozen.isStale &&
                                        "（要確認）"}
                                    </Badge>
                                  )}
                                  {!gradeItemResult.frozen &&
                                    gradeItemResult.overrideGradeLabel !==
                                      null && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        上書き（算出値{" "}
                                        {gradeItemResult.originalGradeLabel ??
                                          "—"}
                                        ）
                                      </Badge>
                                    )}
                                  {!gradeItemResult.isExcluded &&
                                    gradeItemResult.isAllMissing && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs text-muted-foreground"
                                      >
                                        資料なし
                                      </Badge>
                                    )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            )
          )
        )}
      </CardContent>
    </Card>
  )
}
