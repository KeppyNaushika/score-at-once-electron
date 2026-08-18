"use client"

import { useQuery } from "@tanstack/react-query"

import { studentExamResultsQuery } from "@/queries/student"

/** 生徒1人の試験結果一覧 */
export function useStudentExamResults(studentId: string) {
  const { data: results = [], isPending: loading } = useQuery(
    studentExamResultsQuery(studentId)
  )

  return { results, loading }
}
