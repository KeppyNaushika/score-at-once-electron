/**
 * キャンバス上のポインタ操作（新規作成のドラッグ・リサイズ・移動）の受け口。
 *
 * **掴んでいる間は書かない。** リサイズと移動は動かしている途中の姿を
 * `adjustingArea` に持ち、指を離した（`pointerup`）ときに1回だけ `onUpdateArea`
 * を呼ぶ。かつては `pointermove` のたびに書いていたため、領域を1つ動かすだけで
 * 数十回 DB を叩き、取り直しと競り合って枠が跳ねていた。
 *
 * `pointercancel`（別のジェスチャに奪われた・端末が中断した）では書かない。
 * 途中で消えた操作は「そこで確定した」わけではないため。
 */

import type { PointerEvent as ReactPointerEvent } from "react"
import { useCallback, useRef } from "react"

import type {
  AdjustingArea,
  CropRegionArea,
  DetectionMode,
  DragSelectionResult,
  DragState,
  MoveState,
  RegionCoordinates,
  ResizeState,
} from "@/components/exams/02-template/types"
import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"

export function usePointerHandlers({
  disabled,
  backgroundImageUrl,
  imageDimensions,
  examPageId,
  onAddAreaByDrag,
  onUpdateArea,
  getRelativeCoords,
  imageContainerRef,
  dragging,
  dragStartCoords,
  dragCurrentCoords,
  resizing,
  moving,
  adjustingArea,
  setDragging,
  setDragStartCoords,
  setDragCurrentCoords,
  setResizing,
  setMoving,
  setAdjustingArea,
  detectionMode = "manual",
  onSnapToDetectedRects,
}: {
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  examPageId: string | null
  onAddAreaByDrag: (type: CropRegionAreaType, coords: RegionCoordinates) => void
  onUpdateArea: (
    cropRegionId: string,
    coords: RegionCoordinates
  ) => Promise<void>
  getRelativeCoords: (
    clientX: number,
    clientY: number,
    ref: React.RefObject<HTMLDivElement>
  ) => { x: number; y: number }
  imageContainerRef: React.RefObject<HTMLDivElement>
  dragging: boolean
  dragStartCoords: DragState | null
  dragCurrentCoords: DragState | null
  resizing: ResizeState | null
  moving: MoveState | null
  adjustingArea: AdjustingArea | null
  setDragging: (value: boolean) => void
  setDragStartCoords: (value: DragState | null) => void
  setDragCurrentCoords: (value: DragState | null) => void
  setResizing: (value: ResizeState | null) => void
  setMoving: (value: MoveState | null) => void
  setAdjustingArea: (value: AdjustingArea | null) => void
  detectionMode?: DetectionMode
  onSnapToDetectedRects?: (dragRect: RegionCoordinates) => DragSelectionResult
}) {
  const isCreatingRef = useRef(false) // 重複作成防止

  /** 何もない場所を掴んだ = 新しい領域を作るドラッグの始まり */
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      disabled ||
      !backgroundImageUrl ||
      !imageDimensions ||
      !imageContainerRef.current ||
      !examPageId
    )
      return

    const coords = getRelativeCoords(
      event.clientX,
      event.clientY,
      imageContainerRef
    )

    setDragStartCoords(coords)
    setDragCurrentCoords(coords)
    setDragging(true)
  }

  /** 四隅のつまみを掴んだ = リサイズの始まり */
  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    area: CropRegionArea,
    handle: "nw" | "ne" | "sw" | "se"
  ) => {
    event.stopPropagation()
    // 保存前の領域は書き込み先が無いので掴ませない
    if (!imageContainerRef.current || !area.id) return

    setResizing({
      cropRegionId: area.id,
      handle,
      startCoords: getRelativeCoords(
        event.clientX,
        event.clientY,
        imageContainerRef
      ),
      originalArea: {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
      },
    })
  }

  /** 領域の中を掴んだ = 移動の始まり */
  const handleMovePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    area: CropRegionArea
  ) => {
    event.stopPropagation()
    if (!imageContainerRef.current || !area.id) return

    setMoving({
      cropRegionId: area.id,
      startCoords: getRelativeCoords(
        event.clientX,
        event.clientY,
        imageContainerRef
      ),
      originalArea: {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
      },
    })
  }

  /** 動かしている間。途中の姿は手元に置くだけで、DB へは書かない */
  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!imageContainerRef.current) return

      const coords = getRelativeCoords(
        event.clientX,
        event.clientY,
        imageContainerRef
      )

      if (dragging && dragStartCoords) {
        setDragCurrentCoords(coords)
      } else if (resizing) {
        const { cropRegionId, handle, startCoords, originalArea } = resizing
        const deltaX = coords.x - startCoords.x
        const deltaY = coords.y - startCoords.y

        const newArea = { ...originalArea }

        switch (handle) {
          case "nw":
            newArea.x = originalArea.x + deltaX
            newArea.y = originalArea.y + deltaY
            newArea.width = originalArea.width - deltaX
            newArea.height = originalArea.height - deltaY
            break
          case "ne":
            newArea.y = originalArea.y + deltaY
            newArea.width = originalArea.width + deltaX
            newArea.height = originalArea.height - deltaY
            break
          case "sw":
            newArea.x = originalArea.x + deltaX
            newArea.width = originalArea.width - deltaX
            newArea.height = originalArea.height + deltaY
            break
          case "se":
            newArea.width = originalArea.width + deltaX
            newArea.height = originalArea.height + deltaY
            break
        }

        // Ensure minimum size and bounds
        newArea.width = Math.max(0.02, newArea.width)
        newArea.height = Math.max(0.02, newArea.height)
        newArea.x = Math.max(0, Math.min(1 - newArea.width, newArea.x))
        newArea.y = Math.max(0, Math.min(1 - newArea.height, newArea.y))

        setAdjustingArea({ cropRegionId, coords: newArea })
      } else if (moving) {
        const { cropRegionId, startCoords, originalArea } = moving
        const deltaX = coords.x - startCoords.x
        const deltaY = coords.y - startCoords.y

        setAdjustingArea({
          cropRegionId,
          coords: {
            ...originalArea,
            x: Math.max(
              0,
              Math.min(1 - originalArea.width, originalArea.x + deltaX)
            ),
            y: Math.max(
              0,
              Math.min(1 - originalArea.height, originalArea.y + deltaY)
            ),
          },
        })
      }
    },
    [
      dragging,
      dragStartCoords,
      resizing,
      moving,
      getRelativeCoords,
      imageContainerRef,
      setDragCurrentCoords,
      setAdjustingArea,
    ]
  )

  /** 指を離した = ここが操作の終わり。作成も更新もこの1回で書く */
  const handlePointerUp = useCallback(() => {
    // 即座な重複防止チェック（デバウンシング機構）
    if (isCreatingRef.current) {
      return
    }

    // 重複作成を防ぐため、draggingがtrueかつ作成中でない時のみ実行
    if (dragging && dragStartCoords && dragCurrentCoords) {
      // 即座に重複防止フラグを設定
      isCreatingRef.current = true

      const startX = Math.min(dragStartCoords.x, dragCurrentCoords.x)
      const startY = Math.min(dragStartCoords.y, dragCurrentCoords.y)
      const width = Math.abs(dragCurrentCoords.x - dragStartCoords.x)
      const height = Math.abs(dragCurrentCoords.y - dragStartCoords.y)

      // 重複防止のため、先にstateをリセット
      setDragging(false)
      setDragStartCoords(null)
      setDragCurrentCoords(null)

      // Only create area if drag is large enough
      if (width > 0.01 && height > 0.01) {
        const dragRect = { x: startX, y: startY, width, height }

        // 自動モードの場合は検出枠にスナップ
        if (detectionMode === "auto" && onSnapToDetectedRects) {
          const snapped = onSnapToDetectedRects(dragRect)
          if (snapped.selectedRects.length > 0) {
            // 検出枠にスナップした場合は、マージされた境界を使用
            onAddAreaByDrag("QUESTION_ANSWER", snapped.mergedBounds)
          } else {
            // 検出枠にヒットしなかった場合は、元のドラッグ領域を使用
            onAddAreaByDrag("QUESTION_ANSWER", dragRect)
          }
        } else {
          // 手動モードの場合は通常通り
          onAddAreaByDrag("QUESTION_ANSWER", dragRect)
        }
      }

      // 即座にフラグをリセット（setTimeoutは不要）
      isCreatingRef.current = false
    } else {
      // draggingでない場合も確実にリセット
      setDragging(false)
      setDragStartCoords(null)
      setDragCurrentCoords(null)
    }

    // 動かした結果をここで1回だけ書く。**いま終わったジェスチャが掴んでいた**
    // ものだけを書くので、前の操作の残りが別の場面で書かれることはない
    if ((resizing || moving) && adjustingArea) {
      // 書けなかったら手元の姿は嘘になるので捨て、DB の姿へ戻す。書けたときは
      // 取り直しが同じ姿を持ってくるまで見せ続ける（先に捨てると一瞬だけ戻る）
      onUpdateArea(adjustingArea.cropRegionId, adjustingArea.coords).catch(() =>
        setAdjustingArea(null)
      )
    }

    setResizing(null)
    setMoving(null)
  }, [
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    resizing,
    moving,
    adjustingArea,
    onAddAreaByDrag,
    onUpdateArea,
    setDragCurrentCoords,
    setDragStartCoords,
    setDragging,
    setMoving,
    setResizing,
    setAdjustingArea,
    detectionMode,
    onSnapToDetectedRects,
  ])

  /** 操作が中断された。確定していないので書かず、途中の姿も捨てる */
  const handlePointerCancel = useCallback(() => {
    setDragging(false)
    setDragStartCoords(null)
    setDragCurrentCoords(null)
    setResizing(null)
    setMoving(null)
    setAdjustingArea(null)
  }, [
    setDragging,
    setDragStartCoords,
    setDragCurrentCoords,
    setResizing,
    setMoving,
    setAdjustingArea,
  ])

  return {
    handlePointerDown,
    handleResizePointerDown,
    handleMovePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  }
}
