import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { useInvalidateOnSignal } from "@/hooks/useInvalidateOnSignal"
import { annotationsByCropRegionQuery } from "@/queries/drawing"
import type { AnnotationWithContext } from "@/types/drawingAnnotation.types"

interface UseGridAnnotationsProps {
  cropRegionId: string | undefined
  currentUserId: string | undefined
  /** アノテーション変更検知用リフレッシュキー */
  refreshKey?: number
}

interface UseGridAnnotationsReturn {
  /** examStudentId（ExamStudent.id）→ その受験者の注釈 */
  annotationsByExamStudent: Map<string, AnnotationWithContext[]>
}

/** 未取得のときに毎回新しい Map を作らないための空値 */
const EMPTY_ANNOTATIONS = new Map<string, AnnotationWithContext[]>()

/**
 * Grid表示用アノテーション取得フック。
 * 指定 cropRegion の全受験者の注釈を一括取得し、examStudentId でグループ化する。
 * グリッドの行は受験者なので、キーは Student.id ではない。
 */
export function useGridAnnotations({
  cropRegionId,
  currentUserId,
  refreshKey,
}: UseGridAnnotationsProps): UseGridAnnotationsReturn {
  // 同じ設問を続けて開いても取り直さない（重複取得の抑止はキャッシュが担う）
  const queryKey = useMemo(
    () =>
      annotationsByCropRegionQuery(cropRegionId ?? "", currentUserId).queryKey,
    [cropRegionId, currentUserId]
  )

  const { data: annotations } = useQuery({
    ...annotationsByCropRegionQuery(cropRegionId ?? "", currentUserId),
    enabled: Boolean(cropRegionId),
  })

  // 注釈が書き換わったことの合図。取り直しの指示なので setState はしない
  useInvalidateOnSignal(queryKey, refreshKey)

  // 行ごとに束ねるのは計算。キャッシュには main が返した行がそのまま載っている
  const annotationsByExamStudent = useMemo(() => {
    if (!annotations) return EMPTY_ANNOTATIONS
    const grouped = new Map<string, AnnotationWithContext[]>()
    for (const annotation of annotations) {
      // グリッドの行は受験者なので questionScore.examStudentId でまとめる
      const examStudentId = annotation.questionScore?.examStudentId
      if (!examStudentId) continue
      grouped.set(examStudentId, [
        ...(grouped.get(examStudentId) ?? []),
        annotation,
      ])
    }
    return grouped
  }, [annotations])

  return { annotationsByExamStudent }
}
