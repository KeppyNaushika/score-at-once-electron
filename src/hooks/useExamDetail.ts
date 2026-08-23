"use client"

import type { Exam } from "@prisma/client"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { cropRegionsQuery } from "@/queries/cropRegion"
import {
  examForDetailQuery,
  examStudentsQuery,
  updateExamMutation,
} from "@/queries/exam"

/** 試験詳細ページ用のデータ取得・更新フック（生徒数・設問領域数・答案数等の集計を含む） */
export function useExamDetail(examId: string) {
  const currentUser = useCurrentUser()

  const {
    data: exam = null,
    isPending: isLoading,
    isFetching: isReloading,
  } = useQuery(examForDetailQuery(examId))
  const { data: examStudents } = useQuery(examStudentsQuery(examId))
  const { data: cropRegions } = useQuery(cropRegionsQuery(examId))
  const updateExamMutate = useMutation(
    updateExamMutation(examId, currentUser.id)
  )

  const studentCount = examStudents?.length ?? 0
  // 設問領域は「番号かラベルが付いたもの」だけ数える（未設定は進捗に入らない）
  const questionRegionCount =
    cropRegions?.filter(
      (cropRegion) =>
        cropRegion.type === "QUESTION_ANSWER" &&
        (cropRegion.orderIndex || cropRegion.label)
    ).length ?? 0

  /**
   * 試験の基本情報を書き換える。**渡された項目だけを運ぶ**（触っていない列は
   * `undefined` のまま Prisma が見送る）。
   *
   * **成功を知らせない。** 概要ページは1打鍵ごとに書くので、成功トーストを出すと
   * 12文字打てば12枚重なる。成績・資料・解答用紙の同じ操作も出していない
   * （失敗だけを `MutationCache` が1箇所で知らせる）。
   */
  const updateExam = useCallback(
    (
      examData: Partial<
        Pick<Exam, "examName" | "description" | "referenceDate">
      >
    ) => updateExamMutate.mutateAsync(examData),
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
    /** 書き込みの後の取り直しが着地するまで true。塞ぐ側（タグ欄）が見る */
    isReloading,
    studentCount,
    questionRegionCount,
    modelAnswerCount,
    answerSheetCount,
    cropRegionCount,
    updateExam,
  }
}
