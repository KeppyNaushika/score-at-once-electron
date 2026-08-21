"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { questionAnswerRegionsQuery } from "@/queries/cropRegion"
import { examWithPagesQuery, studentAnswerImagesQuery } from "@/queries/exam"
import type { ExamWithPages } from "@/types/prismaExtensions"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

interface ScoringDataLoaderResult {
  loading: boolean
  exam: ExamWithPages | null
  studentAnswerImages: StudentAnswerImageWithExamPageAndStudent[]
  cropRegions: QuestionAnswerRegionRow[]
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ANSWER_IMAGES: StudentAnswerImageWithExamPageAndStudent[] = []
const EMPTY_CROP_REGIONS: QuestionAnswerRegionRow[] = []

/**
 * 採点画面の初期データ（試験・答案・設問領域）を用意する。
 *
 * 3つは別々のキャッシュに載せる。まとめて1つのキーへ入れていた頃は、答案を1枚
 * 消しただけで試験も設問領域も取り直していた。揃うまで待つ必要はあるが、それは
 * 待ち方（`loading`）の話であって、格納の仕方の話ではない。
 */
export function useScoringDataLoader(examId: string): ScoringDataLoaderResult {
  const exam = useQuery({
    ...examWithPagesQuery(examId),
    enabled: Boolean(examId),
  })
  const studentAnswerImages = useQuery({
    ...studentAnswerImagesQuery(examId),
    enabled: Boolean(examId),
  })
  const cropRegions = useQuery({
    ...questionAnswerRegionsQuery(examId),
    enabled: Boolean(examId),
  })

  // 読み込みの失敗は通知する（取得ではないので effect でよい）
  const error = exam.error ?? studentAnswerImages.error ?? cropRegions.error
  useEffect(() => {
    if (error) toast.error("データの読み込みに失敗しました")
  }, [error])

  return {
    // 3つが揃って初めて採点できる。1つでも来ていなければ待たせる
    loading:
      exam.isPending || studentAnswerImages.isPending || cropRegions.isPending,
    exam: exam.data ?? null,
    studentAnswerImages: studentAnswerImages.data ?? EMPTY_ANSWER_IMAGES,
    cropRegions: cropRegions.data ?? EMPTY_CROP_REGIONS,
  }
}
