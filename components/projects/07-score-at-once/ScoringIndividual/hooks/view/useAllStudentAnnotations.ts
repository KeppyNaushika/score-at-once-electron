/**
 * @fileoverview 全設問アノテーション読み込みフック
 * 透明度制御用に現在の学生とプロジェクトの全アノテーションを読み込む
 */
import type { CropRegionWithProjectPage } from "@/components/projects/07-score-at-once/types"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"
import { useEffect, useState } from "react"

/** 全設問アノテーション読み込みフックのパラメータ */
export interface UseAllStudentAnnotationsParams {
  /** 現在の学生ID */
  currentStudentId?: string
  /** 現在の設問領域（プロジェクトID取得用） */
  currentCropRegion?: CropRegionWithProjectPage | null
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
 * 透明度制御用に、現在の学生とプロジェクトの全アノテーションを読み込むフック。
 * Electron APIを直接呼び出してフック依存関係を回避する。
 *
 * @param params - フックパラメータ
 * @returns 全設問のアノテーション
 */
export function useAllStudentAnnotations({
  currentStudentId,
  currentCropRegion,
}: UseAllStudentAnnotationsParams): UseAllStudentAnnotationsReturn {
  const [allStudentAnnotations, setAllStudentAnnotations] = useState<
    DrawingAnnotation[]
  >([])

  useEffect(() => {
    const loadAllAnnotations = async () => {
      if (!currentStudentId || !currentCropRegion?.projectPage?.projectId) {
        setAllStudentAnnotations([])
        return
      }

      try {
        console.log("🎨 透明度制御: 全設問アノテーション読み込み開始", {
          studentId: currentStudentId,
          projectId: currentCropRegion.projectPage.projectId,
        })

        // ElectronAPIを直接呼び出してフック依存関係を回避
        const result = await window.electronAPI.drawing.getByStudent(
          currentStudentId,
          currentCropRegion.projectPage.projectId
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
    currentCropRegion?.projectPage?.projectId,
    currentCropRegion?.id,
  ])

  return { allStudentAnnotations }
}
