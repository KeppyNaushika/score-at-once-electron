/**
 * @fileoverview リサイズハンドルを掴んでから離すまで
 * 掴んだハンドル・要素・掴んだ時点の外形を覚え、動かすたびに外形を計算し直し、
 * 離したときに1回だけ書き込む。
 */
import { useCallback, useState } from "react"

import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import type { ResizeOriginalBounds } from "./useElementResize"

interface UseResizeDragProps {
  drawingElements: DrawingAnnotation[]
  /** 要素をリサイズする（useElementResize のもの。ローカル状態だけを変える） */
  handleElementResize: (
    normalizedX: number,
    normalizedY: number,
    handle: string,
    element: DrawingAnnotation,
    originalBounds: ResizeOriginalBounds
  ) => void
  updateDrawingElement: (
    id: string,
    updates: Partial<DrawingAnnotation>
  ) => void
}

/**
 * リサイズのドラッグ状態
 */
export function useResizeDrag({
  drawingElements,
  handleElementResize,
  updateDrawingElement,
}: UseResizeDragProps) {
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [resizeElementId, setResizeElementId] = useState<string | null>(null)
  const [resizeOriginalBounds, setResizeOriginalBounds] =
    useState<ResizeOriginalBounds | null>(null)

  /** ハンドルを掴む */
  const startResize = useCallback(
    (element: DrawingAnnotation, handleName: string) => {
      setIsResizing(true)
      setResizeHandle(handleName)
      setResizeElementId(element.id)
      setResizeOriginalBounds({
        x: element.x,
        y: element.y,
        width: element.width || 0,
        height: element.height || 0,
      })
    },
    []
  )

  /** 掴んだまま動かす。リサイズ中で要素が見つかったら true */
  const resizeTo = useCallback(
    (imageCoords: { x: number; y: number }): boolean => {
      if (
        !isResizing ||
        !resizeHandle ||
        !resizeElementId ||
        !resizeOriginalBounds
      ) {
        return false
      }
      const resizeElement = drawingElements.find(
        (element) => element.id === resizeElementId
      )
      if (!resizeElement) return false
      handleElementResize(
        imageCoords.x,
        imageCoords.y,
        resizeHandle,
        resizeElement,
        resizeOriginalBounds
      )
      return true
    },
    [
      isResizing,
      resizeHandle,
      resizeElementId,
      resizeOriginalBounds,
      drawingElements,
      handleElementResize,
    ]
  )

  /** 離す。リサイズ後の外形を書き込み、掴んでいた記録を消す */
  const finishResize = useCallback(() => {
    if (resizeElementId) {
      const resizedElement = drawingElements.find(
        (element) => element.id === resizeElementId
      )
      if (resizedElement) {
        const updates: Partial<DrawingAnnotation> = {
          x: resizedElement.x,
          y: resizedElement.y,
        }
        if (resizedElement.type === "text") {
          updates.textBoxWidth = resizedElement.textBoxWidth
          updates.textBoxHeight = resizedElement.textBoxHeight
        } else {
          updates.width = resizedElement.width
          updates.height = resizedElement.height
        }
        updateDrawingElement(resizedElement.id, updates)
      }
    }

    setIsResizing(false)
    setResizeHandle(null)
    setResizeElementId(null)
    setResizeOriginalBounds(null)
  }, [resizeElementId, drawingElements, updateDrawingElement])

  return { isResizing, resizeHandle, startResize, resizeTo, finishResize }
}
