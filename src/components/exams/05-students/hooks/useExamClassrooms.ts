"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import type {
  ExamClassroomWithClassroomAndExam,
  ExamClassroomWithMemberships,
} from "@/electron-src/lib/prisma/examClassroom"
import { queryKeys } from "@/lib/queryKeys"

interface UseExamClassroomsOptions {
  examId: string
}

interface UseExamClassroomsReturn {
  /** 試験に関連付けられたクラス一覧 */
  examClassrooms: ExamClassroomWithMemberships[]
  /** 読み込み中フラグ */
  loading: boolean
  /** データを再取得 */
  refresh: () => Promise<void>
  /** クラスを削除 */
  removeClassroom: (examClassroomId: string) => Promise<boolean>
  /** クラス設定を更新 */
  updateClassroom: (
    examClassroomId: string,
    options: {
      administered?: boolean
      teacherStatistics?: boolean
      studentReport?: boolean
    }
  ) => Promise<ExamClassroomWithClassroomAndExam | null>
}

/**
 * ExamClassroom（試験-クラス関連）を管理するフック
 */
export function useExamClassrooms({
  examId,
}: UseExamClassroomsOptions): UseExamClassroomsReturn {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.exam.classrooms(examId)
  const { data: examClassrooms = [], isPending: loading } = useQuery({
    queryKey,
    queryFn: examId
      ? () => window.electronAPI.examClassroom.getAll(examId)
      : skipToken,
  })

  const fetchExamClassrooms = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  // クラスを削除
  const removeClassroom = useCallback(
    async (examClassroomId: string): Promise<boolean> => {
      try {
        await window.electronAPI.examClassroom.remove(examClassroomId)
        await fetchExamClassrooms()
        return true
      } catch (err) {
        console.error("Failed to remove class from exam:", err)
        return false
      }
    },
    [fetchExamClassrooms]
  )

  // クラス設定を更新
  const updateClassroom = useCallback(
    async (
      examClassroomId: string,
      options: {
        administered?: boolean
        teacherStatistics?: boolean
        studentReport?: boolean
      }
    ): Promise<ExamClassroomWithClassroomAndExam | null> => {
      try {
        const result = await window.electronAPI.examClassroom.update({
          id: examClassroomId,
          ...options,
        })
        await fetchExamClassrooms()
        return result
      } catch (err) {
        console.error("Failed to update exam class:", err)
        return null
      }
    },
    [fetchExamClassrooms]
  )

  return {
    examClassrooms,
    loading,
    refresh: fetchExamClassrooms,
    removeClassroom,
    updateClassroom,
  }
}
