"use client"

import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import type { ExamListItem } from "@/types/common.types"

/** 試験一覧の取得・新規作成を行うフック */
export const useExams = () => {
  const { user } = useAuth()
  const [exams, setExams] = useState<ExamListItem[]>([])

  const loadExams = useCallback(async () => {
    if (!user) {
      setExams([])
      return
    }
    try {
      const fetchedExams = await window.electronAPI.fetchExamsSummary(user.id)
      if (fetchedExams) {
        setExams(fetchedExams)
      } else {
        setExams([])
      }
    } catch (error) {
      console.error("Failed to fetch exams:", error)
    }
  }, [user])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadExams()
    })

    return () => cancelAnimationFrame(frame)
  }, [loadExams])

  const createExam = async (createExamArgs: {
    examName: string
    examDate?: Date | null
    description?: string
    subject?: string
  }) => {
    if (!user) {
      throw new Error("ユーザーがログインしていません")
    }

    try {
      const createdExam = await window.electronAPI.createExam(
        createExamArgs,
        user.id
      )
      return createdExam
    } catch (error) {
      console.error("Failed to create exam:", error)
      throw error
    }
  }

  return {
    exams,
    loadExams,
    createExam,
  }
}
