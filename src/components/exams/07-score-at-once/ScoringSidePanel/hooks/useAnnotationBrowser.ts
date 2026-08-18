"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

import {
  annotationsForBrowseQuery,
  batchCreateAnnotationsMutation,
  createAnnotationMutation,
  toggleAnnotationFavoriteMutation,
} from "@/queries/drawing"
import type {
  AnnotationWithContext,
  DrawingAnnotation,
  DrawingType,
} from "@/types/drawingAnnotation.types"
import { newDrawingAnnotation } from "@/types/drawingAnnotation.types"

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
  examStudentId: string | null
  type: DrawingType | null
  favoritesOnly: boolean
}

// addToTargets用パラメータ
export interface AddToTargetsParams {
  sourceAnnotation: AnnotationWithContext
  /** 追加先。採点者は行き先の QuestionScore が決めるので、別途受け取らない */
  targetQuestionScoreIds: string[]
  targetCropRegionId: string
  sourceCropRegionId: string
}

/**
 * 行から「見た目を決める列」だけを取り出す。
 *
 * 外すのは同定用の id、履歴（時刻）、独立した書き込み経路を持つお気に入り、そして
 * 同梱した関係。main 側の `toAppearance`（drawingAnnotation.ts）と同じ切り方で、
 * 列を足すと自動的に対象へ入る。
 *
 * 返りを `Record` にするのは、比較する側が列名を知らずに回すため（列名を並べた
 * 時点で足し忘れが起きる）。
 */
function toAppearance(
  annotation: AnnotationWithContext
): Record<string, unknown> {
  const {
    questionScore: _questionScore,
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    isFavorite: _isFavorite,
    ...appearance
  } = annotation
  return appearance
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
): Partial<DrawingAnnotation> {
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

interface UseAnnotationBrowserReturn {
  allAnnotations: AnnotationWithContext[]
  displayItems: AnnotationDisplayItem[]
  isLoading: boolean
  filters: AnnotationFilters
  setFilters: (partial: Partial<AnnotationFilters>) => void
  reload: () => Promise<void>
  toggleFavorite: (id: string, currentFavorite: boolean) => Promise<void>
  addToTargets: (params: AddToTargetsParams) => Promise<AddToTargetsResult>
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ANNOTATIONS: AnnotationWithContext[] = []

/**
 * アノテーション一覧の取得・フィルタリング・重複省略・お気に入り・一括追加を
 * 管理するフック。
 *
 * 一覧はキャッシュが持つ。書き込みは注釈のまとまりを取り直すので、追加や
 * お気に入りの切り替えのあとに手元の配列をつつく必要はない。
 */
export function useAnnotationBrowser(
  examId: string
): UseAnnotationBrowserReturn {
  const queryClient = useQueryClient()
  const [filters, setFiltersState] = useState<AnnotationFilters>({
    cropRegionId: null,
    examStudentId: null,
    type: null,
    favoritesOnly: false,
  })

  const setFilters = useCallback((partial: Partial<AnnotationFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
  }, [])

  // 走らせない条件のときは待たせない（`isPending` は無効なクエリでは永久に true）。
  // 待つのは**最初の1回だけ**。書き込みのたびに走る取り直しまで「読み込み中」に
  // すると、1ストロークごとに一覧が消えてスクロール位置が飛ぶ
  const { data: allAnnotations = EMPTY_ANNOTATIONS, isPending } = useQuery({
    ...annotationsForBrowseQuery(examId),
    enabled: Boolean(examId),
  })
  const isLoading = Boolean(examId) && isPending

  const queryKey = useMemo(
    () => annotationsForBrowseQuery(examId).queryKey,
    [examId]
  )
  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  const { mutateAsync: toggleAnnotationFavorite } = useMutation(
    toggleAnnotationFavoriteMutation()
  )
  const { mutateAsync: createAnnotation } = useMutation(
    createAnnotationMutation()
  )
  const { mutateAsync: batchCreateAnnotations } = useMutation(
    batchCreateAnnotationsMutation()
  )

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
    if (filters.examStudentId) {
      filtered = filtered.filter(
        (annotation) =>
          annotation.questionScore?.examStudentId === filters.examStudentId
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
          annotationB.updatedAt.getTime() - annotationA.updatedAt.getTime()
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
        itemB.representative.updatedAt.getTime() -
        itemA.representative.updatedAt.getTime()
      )
    })

    return items
  }, [allAnnotations, filters])

  const toggleFavorite = useCallback(
    async (id: string, currentFavorite: boolean) => {
      try {
        await toggleAnnotationFavorite({
          annotationId: id,
          isFavorite: !currentFavorite,
        })
      } catch {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
      }
    },
    [toggleAnnotationFavorite]
  )

  const addToTargets = useCallback(
    async (params: AddToTargetsParams): Promise<AddToTargetsResult> => {
      const {
        sourceAnnotation,
        targetQuestionScoreIds,
        targetCropRegionId,
        sourceCropRegionId,
      } = params

      // 位置計算: 同一設問→同位置、異設問→中央配置
      const isSameQuestion = sourceCropRegionId === targetCropRegionId
      const positionOverride: Partial<DrawingAnnotation> = isSameQuestion
        ? {}
        : centerPosition(sourceAnnotation)

      // コピー元から見た目の列だけを引き継ぐ。列を選んで詰め替えないので、
      // 列が増えてもコピー先へ運ばれる。
      // 同定と履歴（id・時刻）とお気に入りは引き継がず、新しい行として作る
      const {
        questionScore: _questionScore,
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        isFavorite: _isFavorite,
        ...sourceAppearance
      } = sourceAnnotation

      // コピー後の見た目。重複判定も作成もこの1つから導く
      const targetAppearance = { ...sourceAppearance, ...positionOverride }

      // フロントエンド側重複チェック: allAnnotationsを使ってローカルで判定。
      // 既に同じ見た目のアノテーションを持つ questionScoreId を除外する。
      //
      // 列を並べて突き合わせない。列を足したときに判定へ入れ忘れると、見た目の違う
      // マークを重複と見なしてコピーが黙って落ちる（main 側の重複判定も同じ理由で
      // 構造的に持っている）。
      //
      // questionScoreId だけは比べない。コピー元のものが載っているうえ、行き先は
      // 直前の絞り込みで既に一致させてある。
      const newQuestionScoreIds = targetQuestionScoreIds.filter(
        (questionScoreId) =>
          !allAnnotations.some((existing) => {
            if (existing.questionScore?.id !== questionScoreId) return false
            const existingAppearance = toAppearance(existing)
            return Object.entries(targetAppearance).every(
              ([column, value]) =>
                column === "questionScoreId" ||
                existingAppearance[column] === value
            )
          })
      )

      const skipped = targetQuestionScoreIds.length - newQuestionScoreIds.length

      // 全て重複の場合はIPCリクエストを送らない
      if (newQuestionScoreIds.length === 0) {
        return { created: 0, skipped }
      }

      const newAnnotations: DrawingAnnotation[] = newQuestionScoreIds.map(
        (questionScoreId) =>
          newDrawingAnnotation({ ...targetAppearance, questionScoreId })
      )

      try {
        if (newAnnotations.length === 1) {
          await createAnnotation(newAnnotations[0])
        } else {
          await batchCreateAnnotations(newAnnotations)
        }
        return { created: newAnnotations.length, skipped }
      } catch {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
        return { created: 0, skipped }
      }
    },
    [allAnnotations, batchCreateAnnotations, createAnnotation]
  )

  return {
    allAnnotations,
    displayItems,
    isLoading,
    filters,
    setFilters,
    reload,
    toggleFavorite,
    addToTargets,
  }
}
