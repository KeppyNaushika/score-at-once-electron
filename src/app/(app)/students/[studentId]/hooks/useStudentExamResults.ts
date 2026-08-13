"use client"

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/queryKeys"

/** 生徒1人の試験結果一覧 */
export function useStudentExamResults(studentId: string) {
  const { data: results = [], isPending: loading } = useQuery({
    queryKey: queryKeys.studentExamResults.detail(studentId),
    queryFn: () => window.electronAPI.getStudentExamResults(studentId),
  })

  return { results, loading }
}
