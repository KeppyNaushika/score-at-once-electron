import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"

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
  const queryClient = useQueryClient()
  // 同じ設問を続けて開いても取り直さない（重複取得の抑止はキャッシュが担う）
  const queryKey = useMemo(
    () => ["gridAnnotations", cropRegionId ?? null, currentUserId ?? null],
    [cropRegionId, currentUserId]
  )

  const { data: annotationsByExamStudent = EMPTY_ANNOTATIONS } = useQuery({
    queryKey,
    queryFn: cropRegionId
      ? async () => {
          const annotations = await window.electronAPI.drawing.getByCropRegion(
            cropRegionId,
            currentUserId
          )
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
        }
      : skipToken,
  })

  // 注釈が書き換わったことの合図。取り直しの指示なので setState はしない
  useEffect(() => {
    if (refreshKey === undefined) return
    void queryClient.invalidateQueries({ queryKey })
  }, [refreshKey, queryKey, queryClient])

  return { annotationsByExamStudent }
}
