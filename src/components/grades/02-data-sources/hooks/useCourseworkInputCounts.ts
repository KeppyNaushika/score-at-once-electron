"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { courseworkScoresQuery } from "@/queries/coursework"
import { type GradeStudentRow, gradeStudentsQuery } from "@/queries/grade"
import type { GradeItemWithDataSources } from "@/types/grade.types"

/** 未取得のときに毎回新しい値を作らないための空値 */
const EMPTY_GRADE_STUDENTS: GradeStudentRow[] = []

/**
 * 資料の評価項目を指すデータソースごとの、点数の入り具合。
 *
 * 点数の入力は資料のページに一本化されているので、成績の側では数えて見せるだけ。
 * **数える母数は資料の名簿ではなく成績の対象者**（資料には成績に関係ない生徒も
 * 居うる）。
 */
export function useCourseworkInputCounts(
  gradeId: string,
  gradeItems: readonly GradeItemWithDataSources[]
) {
  const { data: gradeStudents = EMPTY_GRADE_STUDENTS } = useQuery(
    gradeStudentsQuery(gradeId)
  )

  const courseworkSources = useMemo(
    () =>
      gradeItems
        .flatMap((gradeItem) => gradeItem.dataSources)
        .filter((dataSource) => dataSource.type === "coursework"),
    [gradeItems]
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

  const gradeStudentIds = useMemo(
    () => new Set(gradeStudents.map((gradeStudent) => gradeStudent.student.id)),
    [gradeStudents]
  )

  const enteredCountByDataSourceId = useMemo(() => {
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
    return new Map(
      courseworkSources.map((dataSource) => [
        dataSource.id,
        dataSource.courseworkItem
          ? (enteredByItem.get(dataSource.courseworkItem.id) ?? 0)
          : 0,
      ])
    )
  }, [courseworkSources, distinctItemIds, scoreQueries, gradeStudentIds])

  return { enteredCountByDataSourceId, studentCount: gradeStudentIds.size }
}
