"use client"

import { useCallback, useMemo, useState } from "react"

import type {
  AnnotationWithContext,
  DrawingCreateData,
  DrawingType,
} from "@/types/drawingAnnotation.types"

// 重複省略後の表示アイテム
export interface AnnotationDisplayItem {
  /** 代表アノテーション */
  representative: AnnotationWithContext
  /** グループ内のアノテーション数 */
  count: number
  /** グループ内にお気に入りが1件でもあるか */
  isFavorite: boolean
  /** グループ内の全アノテーションID */
  allIds: string[]
}

// フィルタ設定
export interface AnnotationFilters {
  cropRegionId: string | null
  studentId: string | null
  type: DrawingType | null
  favoritesOnly: boolean
}

// addToTargets用パラメータ
export interface AddToTargetsParams {
  sourceAnnotation: AnnotationWithContext
  targetQuestionScoreIds: string[]
  targetCropRegionId: string
  sourceCropRegionId: string
  userId: string
}

/**
 * 重複省略のグルーピングキーを生成
 */
function getGroupingKey(annotation: AnnotationWithContext): string {
  const cropRegionId = annotation.questionScore?.cropRegionId ?? ""
  return [
    cropRegionId,
    annotation.type,
    annotation.text,
    annotation.color,
    annotation.strokeWidth,
    annotation.fontSize,
    annotation.lineStyle,
    annotation.x.toFixed(3),
    annotation.y.toFixed(3),
    annotation.width.toFixed(3),
    annotation.height.toFixed(3),
    annotation.endX.toFixed(3),
    annotation.endY.toFixed(3),
  ].join("|")
}

/**
 * アノテーションの位置を中央配置に変換する
 */
function centerPosition(
  source: AnnotationWithContext
): Partial<DrawingCreateData> {
  if (source.type === "line") {
    const midX = (source.x + source.endX) / 2
    const midY = (source.y + source.endY) / 2
    const offsetX = 0.5 - midX
    const offsetY = 0.5 - midY
    return {
      x: source.x + offsetX,
      y: source.y + offsetY,
      endX: source.endX + offsetX,
      endY: source.endY + offsetY,
      displayX: source.x + offsetX,
      displayY: source.y + offsetY,
    }
  }
  // rect/ellipse/text
  const w = source.type === "text" ? source.textBoxWidth : source.width
  const h = source.type === "text" ? source.textBoxHeight : source.height
  return {
    x: 0.5 - w / 2,
    y: 0.5 - h / 2,
    displayX: 0.5 - w / 2,
    displayY: 0.5 - h / 2,
  }
}

// addToTargetsの結果
export interface AddToTargetsResult {
  /** 実際に作成されたアノテーション数 */
  created: number
  /** 重複としてスキップされた数 */
  skipped: number
}

export interface UseAnnotationBrowserReturn {
  allAnnotations: AnnotationWithContext[]
  displayItems: AnnotationDisplayItem[]
  isLoading: boolean
  filters: AnnotationFilters
  setFilters: (partial: Partial<AnnotationFilters>) => void
  loadAnnotations: (examId: string) => Promise<void>
  toggleFavorite: (id: string, currentFavorite: boolean) => Promise<void>
  addToTargets: (params: AddToTargetsParams) => Promise<AddToTargetsResult>
}

/** アノテーション一覧の取得・フィルタリング・重複省略・お気に入り・一括追加を管理するフック */
export function useAnnotationBrowser(): UseAnnotationBrowserReturn {
  const [allAnnotations, setAllAnnotations] = useState<AnnotationWithContext[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFiltersState] = useState<AnnotationFilters>({
    cropRegionId: null,
    studentId: null,
    type: null,
    favoritesOnly: false,
  })

  const setFilters = useCallback((partial: Partial<AnnotationFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
  }, [])

  const loadAnnotations = useCallback(async (examId: string) => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.drawing.getForBrowse(examId)
      if (result.success && result.data) {
        setAllAnnotations(result.data)
      }
    } catch (error) {
      console.error("アノテーション読み込みエラー:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // フィルタ + 重複省略後の表示リスト
  const displayItems = useMemo(() => {
    // フィルタ適用
    let filtered = allAnnotations
    if (filters.cropRegionId) {
      filtered = filtered.filter(
        (annotation) =>
          annotation.questionScore?.cropRegionId === filters.cropRegionId
      )
    }
    if (filters.studentId) {
      filtered = filtered.filter(
        (annotation) =>
          annotation.questionScore?.studentId === filters.studentId
      )
    }
    if (filters.type) {
      filtered = filtered.filter(
        (annotation) => annotation.type === filters.type
      )
    }
    if (filters.favoritesOnly) {
      filtered = filtered.filter((annotation) => annotation.isFavorite)
    }

    // 重複省略: グルーピング
    const groups = new Map<string, AnnotationWithContext[]>()
    for (const annotation of filtered) {
      const key = getGroupingKey(annotation)
      const existing = groups.get(key)
      if (existing) {
        existing.push(annotation)
      } else {
        groups.set(key, [annotation])
      }
    }

    // 表示アイテムに変換
    const items: AnnotationDisplayItem[] = []
    for (const annotations of groups.values()) {
      // updatedAt descで最新を代表にする
      const sorted = [...annotations].sort(
        (annotationA, annotationB) =>
          new Date(annotationB.updatedAt).getTime() -
          new Date(annotationA.updatedAt).getTime()
      )
      items.push({
        representative: sorted[0],
        count: annotations.length,
        isFavorite: annotations.some((annotation) => annotation.isFavorite),
        allIds: annotations.map((annotation) => annotation.id),
      })
    }

    // ソート: お気に入り優先 → updatedAt desc
    items.sort((itemA, itemB) => {
      if (itemA.isFavorite !== itemB.isFavorite)
        return itemA.isFavorite ? -1 : 1
      return (
        new Date(itemB.representative.updatedAt).getTime() -
        new Date(itemA.representative.updatedAt).getTime()
      )
    })

    return items
  }, [allAnnotations, filters])

  const toggleFavorite = useCallback(
    async (id: string, currentFavorite: boolean) => {
      try {
        const result = await window.electronAPI.drawing.toggleFavorite(
          id,
          !currentFavorite
        )
        if (result.success) {
          // ローカル状態を即時更新
          setAllAnnotations((prev) =>
            prev.map((annotation) =>
              annotation.id === id
                ? { ...annotation, isFavorite: !currentFavorite }
                : annotation
            )
          )
        }
      } catch (error) {
        console.error("お気に入り切替エラー:", error)
      }
    },
    []
  )

  const addToTargets = useCallback(
    async (params: AddToTargetsParams): Promise<AddToTargetsResult> => {
      const {
        sourceAnnotation,
        targetQuestionScoreIds,
        targetCropRegionId,
        sourceCropRegionId,
        userId,
      } = params

      // 位置計算: 同一設問→同位置、異設問→中央配置
      const isSameQuestion = sourceCropRegionId === targetCropRegionId
      const positionOverride = isSameQuestion
        ? {}
        : centerPosition(sourceAnnotation)

      // フロントエンド側重複チェック: allAnnotationsを使ってローカルで判定
      // 既に同一プロパティのアノテーションが存在するquestionScoreIdを除外する
      const newQuestionScoreIds = targetQuestionScoreIds.filter(
        (questionScoreId) => {
          // このquestionScoreIdに紐づく既存アノテーションの中で、ソースと同一のものがあるか
          return !allAnnotations.some((existing) => {
            if (existing.questionScore?.id !== questionScoreId) return false
            // 位置はpositionOverrideを適用した値と比較
            const targetX =
              (positionOverride as { x?: number }).x ?? sourceAnnotation.x
            const targetY =
              (positionOverride as { y?: number }).y ?? sourceAnnotation.y
            const targetEndX =
              (positionOverride as { endX?: number }).endX ??
              sourceAnnotation.endX
            const targetEndY =
              (positionOverride as { endY?: number }).endY ??
              sourceAnnotation.endY
            const targetDisplayX =
              (positionOverride as { displayX?: number }).displayX ??
              sourceAnnotation.displayX
            const targetDisplayY =
              (positionOverride as { displayY?: number }).displayY ??
              sourceAnnotation.displayY

            return (
              existing.type === sourceAnnotation.type &&
              existing.x === targetX &&
              existing.y === targetY &&
              existing.color === sourceAnnotation.color &&
              existing.strokeWidth === sourceAnnotation.strokeWidth &&
              existing.width === sourceAnnotation.width &&
              existing.height === sourceAnnotation.height &&
              existing.endX === targetEndX &&
              existing.endY === targetEndY &&
              existing.lineStyle === sourceAnnotation.lineStyle &&
              existing.text === sourceAnnotation.text &&
              existing.fontSize === sourceAnnotation.fontSize &&
              existing.textBoxWidth === sourceAnnotation.textBoxWidth &&
              existing.textBoxHeight === sourceAnnotation.textBoxHeight &&
              existing.horizontalAlign === sourceAnnotation.horizontalAlign &&
              existing.verticalAlign === sourceAnnotation.verticalAlign &&
              existing.anchorDirection === sourceAnnotation.anchorDirection &&
              existing.displayX === targetDisplayX &&
              existing.displayY === targetDisplayY &&
              existing.userId === userId
            )
          })
        }
      )

      const skipped = targetQuestionScoreIds.length - newQuestionScoreIds.length

      // 全て重複の場合はIPCリクエストを送らない
      if (newQuestionScoreIds.length === 0) {
        return { created: 0, skipped }
      }

      const createDataList: DrawingCreateData[] = newQuestionScoreIds.map(
        (questionScoreId) => ({
          questionScoreId: questionScoreId,
          type: sourceAnnotation.type,
          x: sourceAnnotation.x,
          y: sourceAnnotation.y,
          color: sourceAnnotation.color,
          strokeWidth: sourceAnnotation.strokeWidth,
          width: sourceAnnotation.width,
          height: sourceAnnotation.height,
          endX: sourceAnnotation.endX,
          endY: sourceAnnotation.endY,
          lineStyle: sourceAnnotation.lineStyle,
          text: sourceAnnotation.text,
          fontSize: sourceAnnotation.fontSize,
          textBoxWidth: sourceAnnotation.textBoxWidth,
          textBoxHeight: sourceAnnotation.textBoxHeight,
          horizontalAlign: sourceAnnotation.horizontalAlign,
          verticalAlign: sourceAnnotation.verticalAlign,
          anchorDirection: sourceAnnotation.anchorDirection,
          displayX: sourceAnnotation.displayX,
          displayY: sourceAnnotation.displayY,
          userId,
          ...positionOverride,
        })
      )

      try {
        if (createDataList.length === 1) {
          const result = await window.electronAPI.drawing.create(
            createDataList[0]
          )
          if (result.success && result.data) {
            setAllAnnotations((prev) => [
              result.data as AnnotationWithContext,
              ...prev,
            ])
          }
        } else if (createDataList.length > 1) {
          const result =
            await window.electronAPI.drawing.batchCreate(createDataList)
          if (result.success && result.data) {
            setAllAnnotations((prev) => [
              ...(result.data as AnnotationWithContext[]),
              ...prev,
            ])
          }
        }
        return { created: createDataList.length, skipped }
      } catch (error) {
        console.error("アノテーション追加エラー:", error)
        return { created: 0, skipped }
      }
    },
    [allAnnotations]
  )

  return {
    allAnnotations,
    displayItems,
    isLoading,
    filters,
    setFilters,
    loadAnnotations,
    toggleFavorite,
    addToTargets,
  }
}
