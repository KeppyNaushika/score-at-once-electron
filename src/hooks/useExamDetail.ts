"use client"

import type { Exam } from "@prisma/client"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

/**
 * 詳細画面が持つ試験の形。境界（`fetch-exam-by-id`）の戻り値から導く。
 * 手で書き写すと Decimal → number のような境界の変換に追随できない。
 */
export type ExamForDetail = NonNullable<
  Awaited<ReturnType<typeof window.electronAPI.fetchExamById>>
>

/** 試験詳細ページ用のデータ取得・更新フック（生徒数・設問領域数・答案数等の集計を含む） */
export function useExamDetail(examId: string) {
  const [exam, setExam] = useState<ExamForDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [studentCount, setStudentCount] = useState(0)
  const [questionRegionCount, setQuestionRegionCount] = useState(0)

  const loadExam = useCallback(async () => {
    if (!examId) return

    try {
      setIsLoading(true)
      const result = await window.electronAPI.fetchExamById(examId)

      if (result) {
        setExam(result)

        // 生徒数を取得
        const examStudents = await window.electronAPI.getStudentsForExam(examId)
        setStudentCount(examStudents.length)

        // 設問領域数を取得
        const regionsResult =
          await window.electronAPI.getCropRegionsByExamId(examId)
        if (Array.isArray(regionsResult)) {
          const questionRegions = regionsResult.filter(
            (region) =>
              region.type === "QUESTION_ANSWER" &&
              (region.orderIndex || region.label)
          )
          setQuestionRegionCount(questionRegions.length)
        }
      } else {
        toast.error("試験が見つかりません")
        return false
      }
    } catch (error) {
      console.error("Error loading exam:", error)
      toast.error("試験の読み込みに失敗しました")
      return false
    } finally {
      setIsLoading(false)
    }
    return true
  }, [examId])

  const updateExam = useCallback(
    async (
      examData: Partial<Pick<Exam, "examName" | "description" | "examDate">>
    ) => {
      if (!exam) return false

      try {
        await window.electronAPI.updateExam(exam.id, {
          examName: examData.examName,
          description: examData.description,
          examDate: examData.examDate,
        })
        // 更新IPCはスカラーだけを返す。詳細画面はページ・答案・採点領域まで要るので
        // 取り直す（返り値をそのまま state へ入れると同梱の関係が消える）。
        await loadExam()
        toast.success("試験を更新しました")
        return true
      } catch (error) {
        console.error("Failed to update exam:", error)
        toast.error("試験の更新に失敗しました")
        return false
      }
    },
    [exam, loadExam]
  )

  useEffect(() => {
    loadExam()
  }, [loadExam])

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
  const gradeDataSourceCount = exam?.gradeDataSources?.length || 0

  return {
    exam,
    isLoading,
    studentCount,
    questionRegionCount,
    modelAnswerCount,
    answerSheetCount,
    cropRegionCount,
    gradeDataSourceCount,
    updateExam,
  }
}
