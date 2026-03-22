import { useCallback, useEffect, useRef, useState } from "react"

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

interface UseGridAnnotationsProps {
  cropRegionId: string | undefined
  currentUserId: string | undefined
  /** アノテーション変更検知用リフレッシュキー */
  refreshKey?: number
}

interface UseGridAnnotationsReturn {
  /** studentId → DrawingAnnotation[] のマップ */
  annotationsByStudent: Map<string, DrawingAnnotation[]>
  /** データ読み込み中フラグ */
  isLoading: boolean
}

/**
 * Grid表示用アノテーション取得フック
 * 指定されたcropRegionの全学生のアノテーションを一括取得し、studentIdでグループ化する
 */
export function useGridAnnotations({
  cropRegionId,
  currentUserId,
  refreshKey,
}: UseGridAnnotationsProps): UseGridAnnotationsReturn {
  const [annotationsByStudent, setAnnotationsByStudent] = useState<
    Map<string, DrawingAnnotation[]>
  >(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const lastFetchedRef = useRef<string>("")

  const fetchAnnotations = useCallback(async () => {
    if (!cropRegionId) {
      setAnnotationsByStudent(new Map())
      return
    }

    // 同一cropRegionIdの重複取得を防止
    const fetchKey = `${cropRegionId}:${currentUserId ?? ""}`
    if (lastFetchedRef.current === fetchKey) return

    setIsLoading(true)
    try {
      const result = await window.electronAPI.drawing.getByCropRegion(
        cropRegionId,
        currentUserId
      )

      if (result.success && result.data) {
        // フェッチ成功後にキーを設定（失敗時のリトライを阻害しない）
        lastFetchedRef.current = fetchKey
        const grouped = new Map<string, DrawingAnnotation[]>()
        for (const annotation of result.data) {
          // questionScore.studentId を使用してグループ化
          const studentId = (
            annotation as DrawingAnnotation & {
              questionScore?: { studentId?: string }
            }
          ).questionScore?.studentId
          if (!studentId) continue

          const existing = grouped.get(studentId) || []
          existing.push(annotation)
          grouped.set(studentId, existing)
        }
        setAnnotationsByStudent(grouped)
      } else {
        setAnnotationsByStudent(new Map())
      }
    } catch (error) {
      console.error("Grid用アノテーション取得エラー:", error)
      setAnnotationsByStudent(new Map())
    } finally {
      setIsLoading(false)
    }
  }, [cropRegionId, currentUserId])

  // cropRegionId変更時 または refreshKey変更時に自動再取得
  useEffect(() => {
    lastFetchedRef.current = "" // リセットして再取得を許可
    fetchAnnotations()
  }, [fetchAnnotations, refreshKey])

  return { annotationsByStudent, isLoading }
}
