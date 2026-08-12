"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"

import type { CropRegionWithExamPage } from "@/components/exams/07-score-at-once/types"
import { queryKeys } from "@/lib/queryKeys"
import type { ExamWithPages } from "@/types/prismaExtensions"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

interface ScoringDataLoaderResult {
  loading: boolean
  exam: ExamWithPages | null
  studentAnswerImages: StudentAnswerImageWithExamPageAndStudent[]
  cropRegions: CropRegionWithExamPage[]
  currentUserId: string | null
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ANSWER_IMAGES: StudentAnswerImageWithExamPageAndStudent[] = []
const EMPTY_CROP_REGIONS: CropRegionWithExamPage[] = []

/** 試験・答案・設問領域・ユーザー情報を一括ロードして採点画面の初期データを準備するフック */
export function useScoringDataLoader(
  examId: string,
  authUserId: string | null
): ScoringDataLoaderResult {
  // 試験・答案・設問領域は揃って初めて採点できるので1つの取得にまとめる
  const {
    data,
    isPending: loading,
    error,
  } = useQuery({
    queryKey: queryKeys.exam.scoringPage(examId),
    queryFn: examId
      ? async () => {
          // 試験はスカラー + examPages の1クエリ（重データは別クエリ）
          const [exam, studentAnswerImages, cropRegions] = await Promise.all([
            window.electronAPI.getExamWithPages(examId),
            window.electronAPI.getStudentAnswersByExamId(examId),
            window.electronAPI.getQuestionAnswerRegionsByExamId(examId),
          ])
          if (!exam) throw new Error("試験が見つかりません")
          return { exam, studentAnswerImages, cropRegions }
        }
      : skipToken,
  })

  // 読み込みの失敗は通知する（取得ではないので effect でよい）
  useEffect(() => {
    if (error) toast.error("データの読み込みに失敗しました")
  }, [error])

  return {
    loading,
    exam: data?.exam ?? null,
    studentAnswerImages: data?.studentAnswerImages ?? EMPTY_ANSWER_IMAGES,
    cropRegions: data?.cropRegions ?? EMPTY_CROP_REGIONS,
    // 操作者は AuthContext が唯一の出所。ここで main へ聞き直すと、
    // 同じ「今のユーザー」が2つの出所・2つの形でキャッシュに載る
    currentUserId: authUserId,
  }
}
