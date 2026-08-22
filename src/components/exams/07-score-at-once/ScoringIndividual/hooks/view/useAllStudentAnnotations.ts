/**
 * @fileoverview 全設問アノテーション読み込みフック
 * 透明度制御用に現在の学生と試験の全アノテーションを読み込む
 */
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useInvalidateOnSignal } from "@/hooks/useInvalidateOnSignal"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { annotationsByExamStudentQuery } from "@/queries/drawing"
import type { AnnotationWithContext } from "@/types/drawingAnnotation.types"

/** 全設問アノテーション読み込みフックのパラメータ */
interface UseAllStudentAnnotationsParams {
  /** 現在の学生ID */
  currentExamStudentId?: string
  /** 現在の設問領域（試験ID取得用） */
  currentCropRegion?: QuestionAnswerRegionRow | null
  /** 現在のユーザーID（アノテーション取得のフィルタリング用） */
  currentUserId: string
  /** 外部からのアノテーション変更通知キー（変更時にリロード） */
  refreshKey?: number
}

/** 全設問アノテーション読み込みフックの戻り値 */
interface UseAllStudentAnnotationsReturn {
  /** 全設問のアノテーション */
  allStudentAnnotations: AnnotationWithContext[]
}

/**
 * 全設問アノテーション読み込みフック
 *
 * @description
 * 透明度制御用に、現在の学生と試験の全アノテーションを読み込むフック。
 * Electron APIを直接呼び出してフック依存関係を回避する。
 * currentUserIdを使って、ログインユーザーのアノテーションのみ取得する。
 *
 * @param params - フックパラメータ
 * @returns 全設問のアノテーション
 */
/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ANNOTATIONS: AnnotationWithContext[] = []

export function useAllStudentAnnotations({
  currentExamStudentId,
  currentCropRegion,
  currentUserId,
  refreshKey,
}: UseAllStudentAnnotationsParams): UseAllStudentAnnotationsReturn {
  const queryKey = useMemo(
    () =>
      annotationsByExamStudentQuery(currentExamStudentId ?? "", currentUserId)
        .queryKey,
    [currentExamStudentId, currentUserId]
  )

  // ログインユーザーの手書きだけを取る（透明度制御は自分の描画にしか効かない）
  const { data: allStudentAnnotations = EMPTY_ANNOTATIONS } = useQuery({
    ...annotationsByExamStudentQuery(currentExamStudentId ?? "", currentUserId),
    enabled: Boolean(
      currentExamStudentId && currentCropRegion?.examPage?.examId
    ),
  })

  // 注釈が書き換わったことの合図。取り直しの指示なので setState はしない
  useInvalidateOnSignal(queryKey, refreshKey)

  return { allStudentAnnotations }
}
