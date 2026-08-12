"use client"

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/queryKeys"

/** 学級の生徒ごとの試験結果一覧 */
export function useClassroomExamResults(classroomId: string) {
  const { data: studentResults = [], isPending: loading } = useQuery({
    queryKey: queryKeys.classroomExamResults.detail(classroomId),
    queryFn: () => window.electronAPI.getClassroomExamResults(classroomId),
  })

  return { studentResults, loading }
}
