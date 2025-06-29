"use client"

import { LayoutRegionArea } from "@/types/common.types"
import {
  MouseEvent as ReactMouseEvent,
  RefObject,
  useCallback,
  useEffect,
  useState,
} from "react"

interface AreaRendererProps {
  areas: any[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  onResizeMouseDown: (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
    handle: "nw" | "ne" | "sw" | "se",
  ) => void
  onMoveMouseDown: (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
  ) => void
  imageDimensions: { width: number; height: number } | null
  containerRef: RefObject<HTMLDivElement>
  zoom: number
}

export function AreaRenderer({
  areas,
  selectedAreaIndex,
  onSelectArea,
  onResizeMouseDown,
  onMoveMouseDown,
  imageDimensions,
  containerRef,
  zoom,
}: AreaRendererProps) {
  // 全てのhooksを最初に定義（条件分岐の前に）
  const [containerReady, setContainerReady] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)

  // ウィンドウリサイズ時の再計算を強制
  const triggerUpdate = useCallback(() => {
    setForceUpdate((prev) => prev + 1)
  }, [])

  const convertAreaToDisplayCoords = useCallback(
    (area: any) => {
      if (!imageDimensions || !containerRef.current) {
        return { left: 0, top: 0, width: 0, height: 0 }
      }

      const containerWidth = containerRef.current.clientWidth
      const containerHeight = containerRef.current.clientHeight

      // コンテナサイズが0の場合は描画しない（初期化中）
      if (containerWidth === 0 || containerHeight === 0) {
        return { left: 0, top: 0, width: 0, height: 0 }
      }

      // 標準スクロール方式：ズームのみ考慮した座標計算
      const scaledImageWidth = imageDimensions.width * zoom
      const scaledImageHeight = imageDimensions.height * zoom

      return {
        left: area.x * scaledImageWidth,
        top: area.y * scaledImageHeight,
        width: area.width * scaledImageWidth,
        height: area.height * scaledImageHeight,
      }
    },
    [imageDimensions, zoom, forceUpdate],
  )

  useEffect(() => {
    // refが設定されたら再レンダリングを促す
    if (containerRef.current) {
      setContainerReady(true)
    }

    // ResizeObserverでコンテナサイズの変更を監視
    let resizeObserver: ResizeObserver | null = null

    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        triggerUpdate()
      })
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [containerRef.current, triggerUpdate])

  // refが準備できていない場合は何も描画しない
  if (!containerRef.current) {
    return null
  }

  const getAreaTypeColor = (type: LayoutRegionArea["type"]) => {
    switch (type) {
      case "QUESTION_ANSWER":
        return "rgba(0, 255, 0, 0.3)"
      case "STUDENT_NAME":
        return "rgba(0, 0, 255, 0.3)"
      case "STUDENT_ID":
        return "rgba(255, 0, 255, 0.3)"
      case "TOTAL_SCORE":
        return "rgba(255, 255, 0, 0.3)"
      case "SUBTOTAL_SCORE":
        return "rgba(255, 165, 0, 0.3)"
      default:
        return "rgba(128, 128, 128, 0.3)"
    }
  }

  return (
    <>
      {areas.map((area, index) => {
        const displayCoords = convertAreaToDisplayCoords(area)

        // サイズが0の場合は描画しない
        if (displayCoords.width === 0 || displayCoords.height === 0) {
          return null
        }

        return (
          <div
            key={area.id || `area-${index}`}
            className={`absolute cursor-pointer border-2 ${
              selectedAreaIndex === index
                ? "border-solid border-blue-500"
                : "border-dashed border-white"
            }`}
            style={{
              left: `${displayCoords.left}px`,
              top: `${displayCoords.top}px`,
              width: `${displayCoords.width}px`,
              height: `${displayCoords.height}px`,
              backgroundColor: getAreaTypeColor(area.type),
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelectArea(index)
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              onMoveMouseDown(e, index)
            }}
          >
            {/* ラベル */}
            <div className="absolute -top-6 left-0 rounded border bg-white px-1 text-xs text-black">
              {area.label}
            </div>

            {/* リサイズハンドル */}
            {selectedAreaIndex === index && (
              <>
                {/* 左上 */}
                <div
                  className="absolute -top-1 -left-1 h-3 w-3 cursor-nw-resize border border-white bg-blue-500"
                  onMouseDown={(e) => onResizeMouseDown(e, index, "nw")}
                />
                {/* 右上 */}
                <div
                  className="absolute -top-1 -right-1 h-3 w-3 cursor-ne-resize border border-white bg-blue-500"
                  onMouseDown={(e) => onResizeMouseDown(e, index, "ne")}
                />
                {/* 左下 */}
                <div
                  className="absolute -bottom-1 -left-1 h-3 w-3 cursor-sw-resize border border-white bg-blue-500"
                  onMouseDown={(e) => onResizeMouseDown(e, index, "sw")}
                />
                {/* 右下 */}
                <div
                  className="absolute -right-1 -bottom-1 h-3 w-3 cursor-se-resize border border-white bg-blue-500"
                  onMouseDown={(e) => onResizeMouseDown(e, index, "se")}
                />
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
