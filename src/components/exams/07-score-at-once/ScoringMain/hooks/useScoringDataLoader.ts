"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { questionAnswerRegionsQuery } from "@/queries/cropRegion"
import { examWithPagesQuery, studentAnswerImagesQuery } from "@/queries/exam"
import type { QuestionScoreRow } from "@/queries/scoring"
import { questionScoresQuery } from "@/queries/scoring"
import type { ExamWithPages } from "@/types/prismaExtensions"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

interface ScoringDataLoaderResult {
  loading: boolean
  exam: ExamWithPages | null
  studentAnswerImages: StudentAnswerImageWithExamPageAndStudent[]
  cropRegions: QuestionAnswerRegionRow[]
  /** 設問 id → その設問の採点行。**採点者では絞っていない**（絞るのは読む側） */
  questionScoresByCropRegionId: Map<string, QuestionScoreRow[]>
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ANSWER_IMAGES: StudentAnswerImageWithExamPageAndStudent[] = []
const EMPTY_CROP_REGIONS: QuestionAnswerRegionRow[] = []

/**
 * 設問ごとに届いた採点行を、設問 id で引ける形に束ねる。
 *
 * **並び順で対応させない。** 採点行は自分の `cropRegionId` を持っているので、
 * `useQueries` に渡した順と結果の順が一致することに頼る必要が無い（頼ると、
 * 設問を1つ足した瞬間に別の設問の採点が別の設問の色になる）。
 *
 * `combine` はモジュールの外に置く。中で作ると毎描画で関数の同一性が変わり、
 * TanStack のメモ化（同じ結果なら前回の値をそのまま返す）が効かなくなる。
 */
function combineQuestionScores(
  results: UseQueryResult<QuestionScoreRow[], Error>[]
) {
  const byCropRegionId = new Map<string, QuestionScoreRow[]>()
  for (const result of results) {
    for (const questionScore of result.data ?? []) {
      const scores = byCropRegionId.get(questionScore.cropRegionId)
      if (scores) {
        scores.push(questionScore)
      } else {
        byCropRegionId.set(questionScore.cropRegionId, [questionScore])
      }
    }
  }
  return {
    isPending: results.some((result) => result.isPending),
    error: results.find((result) => result.error)?.error,
    byCropRegionId,
  }
}

/**
 * 採点画面の初期データ（試験・答案・設問領域・採点行）を用意する。
 *
 * 4つは別々のキャッシュに載せる。まとめて1つのキーへ入れていた頃は、答案を1枚
 * 消しただけで試験も設問領域も取り直していた。揃うまで待つ必要はあるが、それは
 * 待ち方（`loading`）の話であって、格納の仕方の話ではない。
 *
 * **採点行はさらに設問ごとに割る。** 採点は「その設問のそのマス」に書くので、
 * 書き込みで古くなるのはその設問だけである。1本にまとめていた頃は、1マス採点する
 * たびに全設問ぶん（データの最大で 多数行・大きな JSON）を取り直していた
 * ——**画面に出ているのは1設問ぶん（1設問ぶん）なのに**。
 *
 * 取る量は変わらない（進捗は全設問ぶんの行を数えるので、結局は全部読む）。
 * 変わるのは**書いたあとに取り直す量**だけで、そこが 大きな JSON から 39KB になる。
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

  // 設問が届いてから、その数だけ引く（届く前は空なので何も走らない）
  const questionScores = useQueries({
    queries: (cropRegions.data ?? []).map((cropRegion) =>
      questionScoresQuery(examId, cropRegion.id)
    ),
    combine: combineQuestionScores,
  })

  // 読み込みの失敗は通知する（取得ではないので effect でよい）
  const error =
    exam.error ??
    studentAnswerImages.error ??
    cropRegions.error ??
    questionScores.error
  useEffect(() => {
    if (error) toast.error("データの読み込みに失敗しました")
  }, [error])

  return {
    // 揃って初めて採点できる。1つでも来ていなければ待たせる
    loading:
      exam.isPending ||
      studentAnswerImages.isPending ||
      cropRegions.isPending ||
      questionScores.isPending,
    exam: exam.data ?? null,
    studentAnswerImages: studentAnswerImages.data ?? EMPTY_ANSWER_IMAGES,
    cropRegions: cropRegions.data ?? EMPTY_CROP_REGIONS,
    questionScoresByCropRegionId: questionScores.byCropRegionId,
  }
}
