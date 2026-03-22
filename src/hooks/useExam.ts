"use client"

import { CropRegion, Exam, MasterImage, Prisma } from "@prisma/client"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export type ExamWithDetails = Exam & {
  examPages?: Array<{
    id: string
    pageNumber: number
    masterImages: MasterImage[]
  }>
  cropRegions?: CropRegion[]
}

export interface ExamStatus {
  hasMasterImages: boolean
  hasCropRegions: boolean
  hasStudentAnswers: boolean
  isGradingComplete: boolean
  nextStep:
    | "master-images"
    | "crop-regions"
    | "student-answers"
    | "grading"
    | "complete"
  progress: number
}

/** 試験データの取得・更新・削除およびステータス管理を提供するカスタムフック */
export function useExam(examId?: string) {
  const [exam, setExam] = useState<ExamWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateExamStatus = useCallback(
    (exam: ExamWithDetails): ExamStatus => {
      const hasMasterImages =
        exam.examPages?.some((page) => page.masterImages.length > 0) ?? false
      const hasCropRegions = (exam.cropRegions?.length ?? 0) > 0
      const hasStudentAnswers = false // TODO: Implement when student answers are added
      const isGradingComplete = false // TODO: Implement when grading is added

      let nextStep: ExamStatus["nextStep"] = "master-images"
      let progress = 0

      if (!hasMasterImages) {
        nextStep = "master-images"
        progress = 0
      } else if (!hasCropRegions) {
        nextStep = "crop-regions"
        progress = 25
      } else if (!hasStudentAnswers) {
        nextStep = "student-answers"
        progress = 50
      } else if (!isGradingComplete) {
        nextStep = "grading"
        progress = 75
      } else {
        nextStep = "complete"
        progress = 100
      }

      return {
        hasMasterImages,
        hasCropRegions,
        hasStudentAnswers,
        isGradingComplete,
        nextStep,
        progress,
      }
    },
    []
  )

  const fetchExam = useCallback(async (id: string) => {
    if (!id) return

    setIsLoading(true)
    setError(null)

    try {
      const fetchedExam = await window.electronAPI.fetchExamById(id)
      if (fetchedExam) {
        setExam(fetchedExam)
      } else {
        setError("試験が見つかりません")
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "試験の読み込みに失敗しました"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateExam = useCallback(
    async (updates: Prisma.ExamUpdateInput) => {
      if (!exam?.id) return

      try {
        const updatedExam = await window.electronAPI.updateExam(
          exam.id,
          updates
        )
        setExam((prev) => (prev ? { ...prev, ...updatedExam } : null))
        return updatedExam
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "試験の更新に失敗しました"
        setError(errorMessage)
        toast.error(errorMessage)
        throw err
      }
    },
    [exam]
  )

  const deleteExam = useCallback(async () => {
    if (!exam) return

    try {
      await window.electronAPI.deleteExam(exam.id)
      setExam(null)
      toast.success("試験を削除しました")
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "試験の削除に失敗しました"
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    }
  }, [exam])

  const refreshExam = useCallback(() => {
    if (exam) {
      fetchExam(exam.id)
    }
  }, [exam, fetchExam])

  useEffect(() => {
    if (examId) {
      fetchExam(examId)
    }
  }, [examId, fetchExam])

  const status = exam ? calculateExamStatus(exam) : null

  return {
    exam,
    status,
    isLoading,
    error,
    fetchExam,
    updateExam,
    deleteExam,
    refreshExam,
    setExam,
  }
}
