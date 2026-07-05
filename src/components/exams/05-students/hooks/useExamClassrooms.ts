"use client"

import { useCallback, useEffect, useState } from "react"

import type {
  ExamClassroomWithDetails,
  ExamClassroomWithMemberships,
} from "@/types/electron/examClassroomApi"

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
  removeClass: (examClassroomId: string) => Promise<boolean>
  /** クラス設定を更新 */
  updateClass: (
    examClassroomId: string,
    options: {
      administered?: boolean
      teacherStatistics?: boolean
      studentReport?: boolean
    }
  ) => Promise<ExamClassroomWithDetails | null>
}

/**
 * ExamClassroom（試験-クラス関連）を管理するフック
 */
export function useExamClassrooms({
  examId,
}: UseExamClassroomsOptions): UseExamClassroomsReturn {
  const [examClassrooms, setExamClassrooms] = useState<
    ExamClassroomWithMemberships[]
  >([])
  const [loading, setLoading] = useState(true)

  // データ取得
  const fetchExamClassrooms = useCallback(async () => {
    if (!examId) return

    setLoading(true)

    try {
      const data = await window.electronAPI.examClassroom.getAll(examId)
      setExamClassrooms(data)
    } catch (err) {
      console.error("Failed to fetch exam classes:", err)
    } finally {
      setLoading(false)
    }
  }, [examId])

  // 初回読み込み
  useEffect(() => {
    fetchExamClassrooms()
  }, [fetchExamClassrooms])

  // クラスを削除
  const removeClass = useCallback(
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
  const updateClass = useCallback(
    async (
      examClassroomId: string,
      options: {
        administered?: boolean
        teacherStatistics?: boolean
        studentReport?: boolean
      }
    ): Promise<ExamClassroomWithDetails | null> => {
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
    removeClass,
    updateClass,
  }
}
