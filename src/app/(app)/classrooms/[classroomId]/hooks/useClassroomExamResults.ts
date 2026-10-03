"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import type { ClassroomStudentExamResult } from "@/electron-src/lib/prisma/student"
import {
  isCurrentMembership,
  matchesMembershipStatusFilter,
  type MembershipStatusFilter,
} from "@/lib/membership"
import { classroomExamResultsQuery } from "@/queries/student"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_RESULTS: ClassroomStudentExamResult[] = []

/**
 * 学級の生徒ごとの試験結果一覧。
 *
 * 結果は所属1件ごとに届くので、同じ学級に2度所属した生徒は1人にまとめる。
 * 在籍中の所属が1件でもあれば在籍中の生徒とし、出席番号もその所属のものを使う。
 */
export function useClassroomExamResults(
  classroomId: string,
  statusFilter: MembershipStatusFilter
) {
  const { data: membershipResults = EMPTY_RESULTS, isPending: loading } =
    useQuery(classroomExamResultsQuery(classroomId))

  const studentResults = useMemo(() => {
    const resultByStudentId = new Map<
      string,
      { studentResult: ClassroomStudentExamResult; isCurrent: boolean }
    >()
    membershipResults.forEach((membershipResult) => {
      const isCurrent = isCurrentMembership(membershipResult)
      const existing = resultByStudentId.get(membershipResult.studentId)
      if (!existing || (isCurrent && !existing.isCurrent)) {
        resultByStudentId.set(membershipResult.studentId, {
          studentResult: membershipResult,
          isCurrent,
        })
      }
    })
    return Array.from(resultByStudentId.values())
      .filter(({ isCurrent }) =>
        matchesMembershipStatusFilter(isCurrent, statusFilter)
      )
      .map(({ studentResult }) => studentResult)
  }, [membershipResults, statusFilter])

  return { studentResults, loading }
}
