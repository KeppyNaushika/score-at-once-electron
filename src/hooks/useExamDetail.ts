"use client"

import type { Exam } from "@prisma/client"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import { useAuth } from "@/contexts/AuthContext"
import { cropRegionsQuery } from "@/queries/cropRegion"
import {
  examForDetailQuery,
  examStudentsQuery,
  updateExamMutation,
} from "@/queries/exam"

/** 試験詳細ページ用のデータ取得・更新フック（生徒数・設問領域数・答案数等の集計を含む） */
export function useExamDetail(examId: string) {
  const { user } = useAuth()

  const { data: exam = null, isPending: isLoading } = useQuery(
    examForDetailQuery(examId)
  )
  const { data: examStudents } = useQuery(examStudentsQuery(examId))
  const { data: cropRegions } = useQuery(cropRegionsQuery(examId))
  const updateExamMutate = useMutation(updateExamMutation(examId, user?.id))

  const studentCount = examStudents?.length ?? 0
  // 設問領域は「番号かラベルが付いたもの」だけ数える（未設定は進捗に入らない）
  const questionRegionCount =
    cropRegions?.filter(
      (cropRegion) =>
        cropRegion.type === "QUESTION_ANSWER" &&
        (cropRegion.orderIndex || cropRegion.label)
    ).length ?? 0

  const updateExam = useCallback(
    async (
      examData: Partial<Pick<Exam, "examName" | "description" | "examDate">>
    ) => {
      try {
        await updateExamMutate.mutateAsync({
          examName: examData.examName,
          description: examData.description,
          examDate: examData.examDate,
        })
        toast.success("試験を更新しました")
        return true
      } catch {
        // 失敗の知らせは中央のトーストが出す。ここでは閉じさせないだけ
        return false
      }
    },
    [updateExamMutate]
  )

  const modelAnswerCount =
    exam?.examPages?.filter((page) => page.imagePath).length || 0
  const answerSheetCount =
    exam?.examPages?.reduce(
      (count, page) => count + (page.studentAnswerImages?.length || 0),
      0
    ) || 0
  const cropRegionCount =
    exam?.examPages?.reduce(
      (count, page) => count + (page.cropRegions?.length || 0),
      0
    ) || 0

  return {
    exam,
    isLoading,
    studentCount,
    questionRegionCount,
    modelAnswerCount,
    answerSheetCount,
    cropRegionCount,
    updateExam,
  }
}
