"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import { useMemo } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  duplicateLetterLabels,
  findLetterScale,
} from "@/lib/shared/letterScaleLookup"
import {
  type CourseworkClassroomRow,
  courseworkClassroomsQuery,
  courseworkDetailQuery,
  courseworkScoresQuery,
  courseworkStudentsQuery,
} from "@/queries/coursework"
import type {
  CourseworkItemWithLetterScales,
  CourseworkStudentWithMemberships,
} from "@/types/coursework.types"

import {
  buildCourseworkStudentRows,
  sortCourseworkItems,
} from "../04-scores/courseworkScoreMatrix"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_STUDENTS: CourseworkStudentWithMemberships[] = []
const EMPTY_CLASSROOMS: CourseworkClassroomRow[] = []

interface CourseworkResultsContainerProps {
  courseworkId: string
}

/** 文字評価記号を換算点に変換（変換表に無い記号は null） */
function letterToScore(
  item: CourseworkItemWithLetterScales,
  letterValue: string | null
): number | null {
  if (letterValue == null) return null
  // 同じ評語の行が2つ在りうる。どちらを採るかは成績算出と同じ決まりで引く
  // （別々に書くと、この画面の換算点と実際の成績が食い違う）
  const match = findLetterScale(item.letterScales, letterValue)
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
  const { data: coursework, isPending: loading } = useQuery(
    courseworkDetailQuery(courseworkId)
  )
  const { data: courseworkStudents = EMPTY_STUDENTS } = useQuery(
    courseworkStudentsQuery(courseworkId)
  )
  const { data: courseworkClassrooms = EMPTY_CLASSROOMS } = useQuery(
    courseworkClassroomsQuery(courseworkId)
  )

  const items = useMemo(
    () => sortCourseworkItems(coursework?.items ?? []),
    [coursework]
  )
  // 点数入力ページと同じキーなので取得は共有される
  const scoreQueries = useQueries({
    queries: items.map((item) => courseworkScoresQuery(item.id)),
  })
  const studentRows = useMemo(() => {
    const scoresByItem = new Map(
      items.map((item, index) => [item.id, scoreQueries[index]?.data ?? []])
    )
    const registeredClassroomIds = new Set(
      courseworkClassrooms.map(
        (courseworkClassroom) => courseworkClassroom.classroomId
      )
    )
    return buildCourseworkStudentRows(
      items,
      courseworkStudents,
      registeredClassroomIds,
      scoresByItem
    )
  }, [items, scoreQueries, courseworkStudents, courseworkClassrooms])

  const hasComments = useMemo(
    () =>
      studentRows.some((row) =>
        items.some((item) => row.cells[item.id]?.comment != null)
      ),
    [studentRows, items]
  )

  /**
   * 変換表に同じ評語が2行ある評価項目。
   *
   * 換算はどの端末でも同じ行（`id` のいちばん小さい方）を採るので**点は揃う**が、
   * もう一方の行は何もしない幽霊として残る。A=100 のつもりで A=90 を足した人は、
   * 自分の入れた点が効いていないことに気づけない。**直せるのは 2. 評価項目**なので、
   * ここでは在ることだけを伝えて、そちらへ送る。
   */
  const itemsWithDuplicateLabels = useMemo(
    () =>
      items
        .map((item) => ({
          item,
          labels: duplicateLetterLabels(item.letterScales),
        }))
        .filter(({ labels }) => labels.length > 0),
    [items]
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
      <p className="mb-4 text-sm text-muted-foreground">
        各生徒の評価項目ごとの値です。文字評価は記号と換算点、加減点・コメントを表示します。
      </p>

      {itemsWithDuplicateLabels.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              同じ評価記号が2つある評価項目があります
            </p>
            <ul className="mt-1 list-inside list-disc">
              {itemsWithDuplicateLabels.map(({ item, labels }) => (
                <li key={item.id}>
                  {item.name}（{labels.join("・")}）
                </li>
              ))}
            </ul>
            <p className="mt-1">
              換算にはどちらか一方だけが使われます。「2. 評価項目」の変換表で、
              要らない行を消してください。
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 text-center">出席番号</TableHead>
              <TableHead className="w-20">学級</TableHead>
              <TableHead className="w-32">氏名</TableHead>
              {items.map((item) => (
                <TableHead key={item.id} className="text-center">
                  {item.name}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
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
                <TableRow key={row.courseworkStudentId}>
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
                    <TableCell className="text-xs text-muted-foreground">
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
                  className="py-8 text-center text-sm text-muted-foreground"
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
