"use client"

import { useCallback, useEffect, useState } from "react"

import type {
  ExamClassWithClass,
  ExamClassWithDetails,
} from "@/types/electron/examClassApi"

interface UseExamClassesOptions {
  examId: string
}

interface UseExamClassesReturn {
  /** 試験に関連付けられたクラス一覧 */
  examClassrooms: ExamClassWithClass[]
  /** 読み込み中フラグ */
  loading: boolean
  /** データを再取得 */
  refresh: () => Promise<void>
  /** クラスを削除 */
  removeClass: (examClassId: string) => Promise<boolean>
  /** クラス設定を更新 */
  updateClass: (
    examClassId: string,
    options: {
      administered?: boolean
      teacherStat?: boolean
      studentReport?: boolean
    }
  ) => Promise<ExamClassWithDetails | null>
}

/**
 * ExamClass（試験-クラス関連）を管理するフック
 */
export function useExamClasses({
  examId,
}: UseExamClassesOptions): UseExamClassesReturn {
  const [examClassrooms, setExamClasses] = useState<ExamClassWithClass[]>([])
  const [loading, setLoading] = useState(true)

  // データ取得
  const fetchExamClasses = useCallback(async () => {
    if (!examId) return

    setLoading(true)

    try {
      const data = await window.electronAPI.examClassroom.getAll(examId)
      setExamClasses(data)
    } catch (err) {
      console.error("Failed to fetch exam classes:", err)
    } finally {
      setLoading(false)
    }
  }, [examId])

  // 初回読み込み
  useEffect(() => {
    fetchExamClasses()
  }, [fetchExamClasses])

  // クラスを削除
  const removeClass = useCallback(
    async (examClassId: string): Promise<boolean> => {
      try {
        await window.electronAPI.examClassroom.remove(examClassId)
        await fetchExamClasses()
        return true
      } catch (err) {
        console.error("Failed to remove class from exam:", err)
        return false
      }
    },
    [fetchExamClasses]
  )

  // クラス設定を更新
  const updateClass = useCallback(
    async (
      examClassId: string,
      options: {
        administered?: boolean
        teacherStat?: boolean
        studentReport?: boolean
      }
    ): Promise<ExamClassWithDetails | null> => {
      try {
        const result = await window.electronAPI.examClassroom.update({
          id: examClassId,
          ...options,
        })
        await fetchExamClasses()
        return result
      } catch (err) {
        console.error("Failed to update exam class:", err)
        return null
      }
    },
    [fetchExamClasses]
  )

  return {
    examClassrooms,
    loading,
    refresh: fetchExamClasses,
    removeClass,
    updateClass,
  }
}
