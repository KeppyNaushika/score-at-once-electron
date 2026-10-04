/**
 * @fileoverview 描画要素のお気に入り（パレットの★ボタン）
 */
import { useMutation } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import { toggleAnnotationFavoriteMutation } from "@/queries/drawing"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

interface UseAnnotationFavoritesParams {
  drawingElements: DrawingAnnotation[]
  setDrawingElements: React.Dispatch<React.SetStateAction<DrawingAnnotation[]>>
}

/**
 * お気に入りの描画要素と、その切り替え
 *
 * @returns お気に入りの id の集合と、選んだ要素のお気に入りを反転させる関数
 */
export function useAnnotationFavorites({
  drawingElements,
  setDrawingElements,
}: UseAnnotationFavoritesParams) {
  const { mutateAsync: toggleFavorite } = useMutation(
    toggleAnnotationFavoriteMutation()
  )

  // お気に入りアノテーションIDのセット
  const favoriteElementIds = useMemo(
    () =>
      new Set(
        drawingElements
          .filter((element) => element.isFavorite)
          .map((element) => element.id)
      ),
    [drawingElements]
  )

  // お気に入り切替ハンドラ
  const handleToggleFavorite = useCallback(
    async (elementIds: string[]) => {
      for (const elementId of elementIds) {
        const isFavorite = favoriteElementIds.has(elementId)
        try {
          await toggleFavorite({
            annotationId: elementId,
            isFavorite: !isFavorite,
          })
          // 手元の描画要素は state が持つ（キャンバスの描き直しはここを見る）
          setDrawingElements((prev) =>
            prev.map((element) =>
              element.id === elementId
                ? { ...element, isFavorite: !isFavorite }
                : element
            )
          )
        } catch {
          // 失敗の通知は MutationCache の後始末が出す
        }
      }
    },
    [favoriteElementIds, setDrawingElements, toggleFavorite]
  )

  return { favoriteElementIds, handleToggleFavorite }
}
