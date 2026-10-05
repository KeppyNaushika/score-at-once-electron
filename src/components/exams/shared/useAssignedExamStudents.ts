"use client"

import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import {
  type ExamStudentAssignmentRow,
  examStudentAssignmentsQuery,
} from "@/queries/scoring"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ASSIGNMENTS: ExamStudentAssignmentRow[] = []

interface UseAssignedExamStudentsParams {
  examId: string
  userId: string
  /** 「すべて表示」。true なら担当で絞らない */
  showAll: boolean
}

/**
 * 受験生徒の担当にもとづいて「その人の画面に出る生徒」を決める（07 採点・06 答案）。
 *
 * 絞り込みの規則（docs/scoring-scope-and-permissions-design.md §2-2・§2-3）:
 * - **役割では決めない。** OWNER でも自分の割り当てで絞る（OWNER の特権は割り当てを
 *   変えられることで、絞り込みを無視することではない）。全体を見たいときは「すべて表示」
 * - **担当0人の生徒は全員担当。** 学級に属さない生徒・割り当て忘れの生徒が誰の画面
 *   からも消えないように
 *
 * 担当は権限ではなく選択肢の定義なので、絞った生徒の採点を main が拒むことはない。
 */
export function useAssignedExamStudents({
  examId,
  userId,
  showAll,
}: UseAssignedExamStudentsParams) {
  const { data } = useQuery({
    ...examStudentAssignmentsQuery(examId),
    enabled: Boolean(examId),
  })
  const assignments = data ?? EMPTY_ASSIGNMENTS

  /** 受験生徒 → 担当者。担当0人の生徒は載らない */
  const assigneeIdsByExamStudentId = useMemo(
    () =>
      assignments.reduce((acc, assignment) => {
        const assigneeIds =
          acc.get(assignment.examStudentId) ?? new Set<string>()
        assigneeIds.add(assignment.userId)
        acc.set(assignment.examStudentId, assigneeIds)
        return acc
      }, new Map<string, Set<string>>()),
    [assignments]
  )

  /** 自分の担当で絞ったときに出る生徒か（担当0人か、自分が担当） */
  const isAssignedToMe = useCallback(
    (examStudentId: string): boolean => {
      const assigneeIds = assigneeIdsByExamStudentId.get(examStudentId)
      return !assigneeIds || assigneeIds.has(userId)
    },
    [assigneeIdsByExamStudentId, userId]
  )

  /** 画面に出す生徒か。「すべて表示」なら全員 */
  const isVisibleExamStudent = useCallback(
    (examStudentId: string): boolean =>
      showAll || isAssignedToMe(examStudentId),
    [showAll, isAssignedToMe]
  )

  return {
    isVisibleExamStudent,
    isAssignedToMe,
    /** 生徒の担当が1件でもあるか（無ければ絞り込みも「すべて表示」も要らない） */
    hasStudentAssignments: assignments.length > 0,
  }
}
