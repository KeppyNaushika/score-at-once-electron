/**
 * @fileoverview 全設問アノテーション読み込みフック
 * 透明度制御用に現在の学生と試験の全アノテーションを読み込む
 */
import { useEffect, useState } from "react"

import type { CropRegionWithExamPage } from "@/components/exams/07-score-at-once/types"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

/** 全設問アノテーション読み込みフックのパラメータ */
export interface UseAllStudentAnnotationsParams {
  /** 現在の学生ID */
  currentStudentId?: string
  /** 現在の設問領域（試験ID取得用） */
  currentCropRegion?: CropRegionWithExamPage | null
  /** 現在のユーザーID（アノテーション取得のフィルタリング用） */
  currentUserId?: string
}

/** 全設問アノテーション読み込みフックの戻り値 */
export interface UseAllStudentAnnotationsReturn {
  /** 全設問のアノテーション */
  allStudentAnnotations: DrawingAnnotation[]
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
export function useAllStudentAnnotations({
  currentStudentId,
  currentCropRegion,
  currentUserId,
}: UseAllStudentAnnotationsParams): UseAllStudentAnnotationsReturn {
  const [allStudentAnnotations, setAllStudentAnnotations] = useState<
    DrawingAnnotation[]
  >([])

  useEffect(() => {
    const loadAllAnnotations = async () => {
      if (!currentStudentId || !currentCropRegion?.examPage?.examId) {
        setAllStudentAnnotations([])
        return
      }

      try {
        console.log("🎨 透明度制御: 全設問アノテーション読み込み開始", {
          studentId: currentStudentId,
          examId: currentCropRegion.examPage.examId,
          userId: currentUserId,
        })

        // ElectronAPIを直接呼び出してフック依存関係を回避
        // currentUserIdを渡してログインユーザーのアノテーションのみ取得
        const result = await window.electronAPI.drawing.getByStudent(
          currentStudentId,
          currentCropRegion.examPage.examId,
          undefined, // type
          currentUserId
        )

        if (result.success && result.data) {
          console.log("🎨 透明度制御: 読み込み完了", {
            annotationCount: result.data.length,
            currentCropRegionId: currentCropRegion?.id,
          })
          setAllStudentAnnotations(result.data)
        } else {
          console.error("全設問アノテーション読み込みエラー:", result.error)
          setAllStudentAnnotations([])
        }
      } catch (error) {
        console.error("全設問アノテーション読み込みエラー:", error)
        setAllStudentAnnotations([])
      }
    }

    loadAllAnnotations()
  }, [
    currentStudentId,
    currentCropRegion?.examPage?.examId,
    currentCropRegion?.id,
    currentUserId,
  ])

  return { allStudentAnnotations }
}
