"use client"

import type { Exam } from "@prisma/client"
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import { queryKeys } from "@/lib/queryKeys"

/**
 * 詳細画面が持つ試験の形。境界（`fetch-exam-by-id`）の戻り値から導く。
 * 手で書き写すと Decimal → number のような境界の変換に追随できない。
 */
export type ExamForDetail = NonNullable<
  Awaited<ReturnType<typeof window.electronAPI.fetchExamById>>
>

/** 試験詳細ページ用のデータ取得・更新フック（生徒数・設問領域数・答案数等の集計を含む） */
export function useExamDetail(examId: string) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.exam.detailPage(examId)

  // 詳細画面が読むのは「試験本体」と「進捗の分母になる件数」。3つとも同じ
  // 表示の一部なので1つの取得にまとめる（片方だけ古い状態にならない）
  const { data, isPending: isLoading } = useQuery({
    queryKey,
    queryFn: examId
      ? async () => {
          const exam = await window.electronAPI.fetchExamById(examId)
          if (!exam) throw new Error("試験が見つかりません")

          const [examStudents, cropRegions] = await Promise.all([
            window.electronAPI.getStudentsForExam(examId),
            window.electronAPI.getCropRegionsByExamId(examId),
          ])
          return {
            exam,
            studentCount: examStudents.length,
            // 設問領域は「番号かラベルが付いたもの」だけ数える（未設定は進捗に入らない）
            questionRegionCount: cropRegions.filter(
              (region) =>
                region.type === "QUESTION_ANSWER" &&
                (region.orderIndex || region.label)
            ).length,
          }
        }
      : skipToken,
  })
  const exam = data?.exam ?? null
  const studentCount = data?.studentCount ?? 0
  const questionRegionCount = data?.questionRegionCount ?? 0

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
        // 試験名はパンくずなど他のキーも読むので、試験に紐づくものをまとめて。
        await queryClient.invalidateQueries({
          queryKey: queryKeys.exam.scope(exam.id),
        })
        toast.success("試験を更新しました")
        return true
      } catch (error) {
        console.error("Failed to update exam:", error)
        toast.error("試験の更新に失敗しました")
        return false
      }
    },
    [exam, queryClient]
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
