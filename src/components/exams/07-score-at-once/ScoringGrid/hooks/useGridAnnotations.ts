import { useCallback, useEffect, useRef, useState } from "react"

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
  const [annotationsByExamStudent, setAnnotationsByExamStudent] = useState<
    Map<string, AnnotationWithContext[]>
  >(new Map())
  const lastFetchedRef = useRef<string>("")

  const fetchAnnotations = useCallback(async () => {
    if (!cropRegionId) {
      setAnnotationsByExamStudent(new Map())
      return
    }

    // 同一cropRegionIdの重複取得を防止
    const fetchKey = `${cropRegionId}:${currentUserId ?? ""}`
    if (lastFetchedRef.current === fetchKey) return

    try {
      const result = await window.electronAPI.drawing.getByCropRegion(
        cropRegionId,
        currentUserId
      )

      if (result.success && result.data) {
        // フェッチ成功後にキーを設定（失敗時のリトライを阻害しない）
        lastFetchedRef.current = fetchKey
        const grouped = new Map<string, AnnotationWithContext[]>()
        for (const annotation of result.data) {
          // グリッドの行は受験者なので questionScore.examStudentId でまとめる
          const examStudentId = annotation.questionScore?.examStudentId
          if (!examStudentId) continue

          const existing = grouped.get(examStudentId) || []
          existing.push(annotation)
          grouped.set(examStudentId, existing)
        }
        setAnnotationsByExamStudent(grouped)
      } else {
        setAnnotationsByExamStudent(new Map())
      }
    } catch (error) {
      console.error("Grid用アノテーション取得エラー:", error)
      setAnnotationsByExamStudent(new Map())
    }
  }, [cropRegionId, currentUserId])

  // cropRegionId変更時 または refreshKey変更時に自動再取得
  useEffect(() => {
    lastFetchedRef.current = "" // リセットして再取得を許可
    fetchAnnotations()
  }, [fetchAnnotations, refreshKey])

  return { annotationsByExamStudent }
}
