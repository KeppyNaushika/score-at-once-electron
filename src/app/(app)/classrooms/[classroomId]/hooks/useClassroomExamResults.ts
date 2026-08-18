"use client"

import { useQuery } from "@tanstack/react-query"

import { classroomExamResultsQuery } from "@/queries/student"

/** 学級の生徒ごとの試験結果一覧 */
export function useClassroomExamResults(classroomId: string) {
  const { data: studentResults = [], isPending: loading } = useQuery(
    classroomExamResultsQuery(classroomId)
  )

  return { studentResults, loading }
}
