"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { courseworkScoresQuery } from "@/queries/coursework"
import {
  gradeDetailQuery,
  type GradeStudentRow,
  gradeStudentsQuery,
} from "@/queries/grade"

interface ManualScoresContainerProps {
  gradeId: string
}

/**
 * 試験外成績資料の入力状況 確認ビュー（読み取り専用）
 *
 * 点数入力は試験外成績資料（Coursework）ページに一本化されたため、
 * このステップでは成績算出が参照している coursework 型データソースの一覧と
 * 入力状況を表示し、各資料ページへのリンクを提供する。
 */
/** 未取得のときに毎回新しい値を作らないための空値 */
const EMPTY_GRADE_STUDENTS: GradeStudentRow[] = []

export function ManualScoresContainer({ gradeId }: ManualScoresContainerProps) {
  const { data: grade, isPending: gradePending } = useQuery(
    gradeDetailQuery(gradeId)
  )
  const { data: gradeStudents = EMPTY_GRADE_STUDENTS } = useQuery(
    gradeStudentsQuery(gradeId)
  )

  const courseworkSources = useMemo(
    () =>
      (grade?.gradeItems ?? [])
        .flatMap((gradeItem) => gradeItem.dataSources)
        .filter((dataSource) => dataSource.type === "coursework"),
    [grade]
  )

  // 評価項目は重複し得る（複数データソースが同一項目を参照）ので、項目ごとに
  // 1回だけ点数を取る。同じキーなので資料ページと同じキャッシュを共有する。
  const distinctItemIds = useMemo(
    () => [
      ...new Set(
        courseworkSources
          .map((dataSource) => dataSource.courseworkItem?.id)
          .filter((courseworkItemId) => courseworkItemId !== undefined)
      ),
    ],
    [courseworkSources]
  )
  const scoreQueries = useQueries({
    queries: distinctItemIds.map((courseworkItemId) =>
      courseworkScoresQuery(courseworkItemId)
    ),
  })

  // この成績の対象生徒ID（資料の名簿ではなく成績側の名簿で数える）
  const gradeStudentIds = useMemo(
    () => new Set(gradeStudents.map((gradeStudent) => gradeStudent.student.id)),
    [gradeStudents]
  )

  const enteredCounts = useMemo(() => {
    const enteredByItem = new Map<string, number>()
    distinctItemIds.forEach((courseworkItemId, index) => {
      const scores = scoreQueries[index]?.data ?? []
      enteredByItem.set(
        courseworkItemId,
        scores.filter(
          // 成績の対象生徒は人（Student）で数えるので、対象者から生徒へ1段辿る
          (courseworkScore) =>
            gradeStudentIds.has(courseworkScore.courseworkStudent.studentId) &&
            (courseworkScore.score !== null ||
              courseworkScore.letterValue !== null)
        ).length
      )
    })
    const counts: Record<string, number> = {}
    for (const dataSource of courseworkSources) {
      const courseworkItemId = dataSource.courseworkItem?.id
      counts[dataSource.id] = courseworkItemId
        ? (enteredByItem.get(courseworkItemId) ?? 0)
        : 0
    }
    return counts
  }, [courseworkSources, distinctItemIds, scoreQueries, gradeStudentIds])

  const studentCount = gradeStudentIds.size
  const loading = gradePending

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-2 text-lg font-semibold">試験外成績資料の確認</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        点数の入力は「試験外成績資料」ページで行います。ここでは成績算出が参照している
        評価項目と入力状況を確認できます。点数を編集するには各資料ページを開いてください。
      </p>

      {courseworkSources.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
          <p className="mb-2 text-muted-foreground">
            試験外成績資料のデータソースがありません
          </p>
          <p className="text-sm text-muted-foreground">
            データソース設定で「試験外成績資料」を追加してください
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {courseworkSources.map((dataSource) => {
            const item = dataSource.courseworkItem
            const enteredCount = enteredCounts[dataSource.id] ?? 0
            return (
              <div
                key={dataSource.id}
                className="flex items-center justify-between rounded border p-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">資料</Badge>
                  <span className="text-sm font-medium">{dataSource.name}</span>
                  {item && (
                    <span className="text-xs text-muted-foreground">
                      ({item.coursework.name} &gt; {item.name})
                    </span>
                  )}
                  {item?.inputMode === "letter" && (
                    <Badge variant="outline" className="text-xs font-normal">
                      文字評価
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    入力済み: {enteredCount}/{studentCount}名 / 満点:{" "}
                    {item?.maxScore ?? dataSource.maxScore}
                  </span>
                  {item && (
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={`/coursework/${item.coursework.id}/04-scores`}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        資料を開く
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button asChild>
          <Link href={`/grades/${gradeId}/05-boundaries`}>次へ: 成績境界</Link>
        </Button>
      </div>
    </div>
  )
}
