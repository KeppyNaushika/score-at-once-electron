"use client"

import { useQueries, useQuery } from "@tanstack/react-query"

import { gradeResultsQuery } from "@/queries/grade"
import { studentGradeRosterQuery } from "@/queries/student"

/**
 * 生徒が載っている成績算出ごとの、その生徒の算出結果。
 *
 * 算出は成績算出の単位でしかできない（境界・欠測の推定が名簿全体に掛かる）ので、
 * 05-results と同じ `gradeResultsQuery` を成績算出ごとに引き、この生徒の行だけを
 * 取り出す。キーが 05-results と同じなので、書き込みの後の取り直しもそのまま効く。
 */
export function useStudentGradeResults(studentId: string) {
  const { data: studentWithGradeRoster, isPending: rosterLoading } = useQuery(
    studentGradeRosterQuery(studentId)
  )
  const gradeStudents = studentWithGradeRoster?.gradeStudents ?? []

  const gradeResultQueries = useQueries({
    queries: gradeStudents.map((gradeStudent) =>
      gradeResultsQuery(gradeStudent.gradeId)
    ),
  })

  const gradeResults = gradeStudents.map((gradeStudent, index) => {
    const gradeResultQuery = gradeResultQueries[index]
    return {
      gradeStudent,
      calculationResult: gradeResultQuery?.data ?? null,
      studentResult:
        gradeResultQuery?.data?.students.find(
          (studentResult) => studentResult.studentId === studentId
        ) ?? null,
      loading: gradeResultQuery?.isPending ?? true,
    }
  })

  return { gradeResults, loading: rosterLoading }
}
