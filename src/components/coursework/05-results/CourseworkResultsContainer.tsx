"use client"

import { useMemo } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CourseworkItemWithLetterScales } from "@/types/coursework.types"

import { useCourseworkScores } from "../04-scores/hooks/useCourseworkScores"

interface CourseworkResultsContainerProps {
  courseworkId: string
}

/** 文字評価記号を換算点に変換（変換表に無い記号は null） */
function letterToScore(
  item: CourseworkItemWithLetterScales,
  letterValue: string | null
): number | null {
  if (letterValue == null) return null
  const match = item.letterScales.find(
    (letterScale) => letterScale.label === letterValue
  )
  return match ? match.score : null
}

/**
 * 試験外成績資料の結果集計コンテナ（読み取り専用）
 *
 * 生徒×評価項目の値一覧を表示する。文字評価はラベルと換算点を併記し、
 * 加減点・コメントも表示する。
 */
export function CourseworkResultsContainer({
  courseworkId,
}: CourseworkResultsContainerProps) {
  const { items, studentRows, loading } = useCourseworkScores(courseworkId)

  const hasComments = useMemo(
    () =>
      studentRows.some((row) =>
        items.some((item) => row.cells[item.id]?.comment != null)
      ),
    [studentRows, items]
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="p-6">
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground">評価項目がありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">結果</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        各生徒の評価項目ごとの値です。文字評価は記号と換算点、加減点・コメントを表示します。
      </p>

      <div className="border-border/50 overflow-x-auto rounded-xl border shadow-sm">
        <Table>
          <TableHeader className="bg-card sticky top-0 z-10">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 text-center">出席番号</TableHead>
              <TableHead className="w-20">学級</TableHead>
              <TableHead className="w-32">氏名</TableHead>
              {items.map((item) => (
                <TableHead key={item.id} className="text-center">
                  {item.name}
                  <span className="text-muted-foreground ml-1 text-xs font-normal">
                    {item.inputMode === "letter"
                      ? "(評価)"
                      : `(/${item.maxScore})`}
                  </span>
                </TableHead>
              ))}
              {hasComments && <TableHead>コメント</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {studentRows.map((row) => {
              const comments = items
                .map((item) => {
                  const comment = row.cells[item.id]?.comment
                  return comment ? `${item.name}: ${comment}` : null
                })
                .filter((comment): comment is string => comment != null)

              return (
                <TableRow key={row.studentId}>
                  <TableCell className="text-center text-sm">
                    {row.attendanceNumber != null ? row.attendanceNumber : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.className ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.lastName} {row.firstName}
                  </TableCell>
                  {items.map((item) => {
                    const cell = row.cells[item.id]
                    const adjustment = cell?.adjustment ?? null
                    let display: string
                    if (item.inputMode === "letter") {
                      if (cell?.letterValue == null) {
                        display = "-"
                      } else {
                        const converted = letterToScore(item, cell.letterValue)
                        display =
                          converted != null
                            ? `${cell.letterValue} (${converted})`
                            : cell.letterValue
                      }
                    } else {
                      display = cell?.score != null ? String(cell.score) : "-"
                    }
                    return (
                      <TableCell key={item.id} className="text-center text-sm">
                        {display}
                        {adjustment != null && adjustment !== 0 && (
                          <span
                            className={
                              adjustment > 0
                                ? "ml-1 text-xs text-blue-600"
                                : "ml-1 text-xs text-red-600"
                            }
                            title={cell?.adjustmentReason ?? undefined}
                          >
                            {adjustment > 0 ? `+${adjustment}` : adjustment}
                          </span>
                        )}
                      </TableCell>
                    )
                  })}
                  {hasComments && (
                    <TableCell className="text-muted-foreground text-xs">
                      {comments.length > 0 ? comments.join(" / ") : "-"}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {studentRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={items.length + (hasComments ? 4 : 3)}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  対象生徒がいません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
