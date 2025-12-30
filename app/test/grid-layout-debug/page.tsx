"use client"

import { useState, useRef, useEffect, useCallback } from "react"

type LayoutDirection = "right-down" | "left-down" | "down-right" | "down-left"

interface TestImageProps {
  index: number
  isColumnLayout: boolean
  itemsPerRow: number
  aspectRatio: number // width / height
  containerRef: React.RefObject<HTMLDivElement | null>
  calculatedCellHeight: number // 親から渡された計算済み高さ
}

function TestImage({
  index,
  isColumnLayout,
  itemsPerRow,
  aspectRatio,
  containerRef,
  calculatedCellHeight,
}: TestImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [_parentSize, setParentSize] = useState({ width: 0, height: 0 })
  const [canvasCssSize, setCanvasCssSize] = useState({ width: 0, height: 0 })

  const calculateAndDraw = useCallback(() => {
    const canvas = canvasRef.current
    const parent = parentRef.current
    const container = containerRef.current
    if (!canvas || !parent || !container) return

    // 方法1: 親要素から直接取得（デバッグ用）
    const parentWidth = parent.offsetWidth
    const parentHeight = parent.offsetHeight
    setParentSize({ width: parentWidth, height: parentHeight })

    // 方法2: グリッドコンテナから計算
    const containerWidth = container.offsetWidth
    const _containerHeight = container.offsetHeight
    const gap = 8 // gap-2 = 8px
    const padding = 4 // p-1 = 4px

    let calculatedCellWidth: number
    let cellHeight: number

    if (isColumnLayout) {
      // 列レイアウト: 親から渡された計算済み高さを使用
      cellHeight = calculatedCellHeight
      calculatedCellWidth = cellHeight * aspectRatio
    } else {
      // 行レイアウト: 幅を均等分割
      const availableWidth =
        containerWidth - padding * 2 - gap * (itemsPerRow - 1)
      calculatedCellWidth = availableWidth / itemsPerRow
      cellHeight = calculatedCellWidth / aspectRatio
    }

    // 計算されたサイズを使用
    let canvasWidth: number
    let canvasHeight: number

    if (isColumnLayout) {
      // セル内: pt-1(4px) + pb-0(0px) + gap-0.5(2px) + footer(~14px) = 20px
      canvasHeight = cellHeight - 20
      canvasWidth = canvasHeight * aspectRatio
    } else {
      // セル内: p-1(8px) = 左右で8px
      canvasWidth = calculatedCellWidth - 8
      canvasHeight = canvasWidth / aspectRatio
    }

    canvas.width = Math.max(10, canvasWidth)
    canvas.height = Math.max(10, canvasHeight)
    setDimensions({ width: canvas.width, height: canvas.height })
    setCanvasCssSize({ width: canvas.width, height: canvas.height })

    // 描画
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.fillStyle = `hsl(${(index * 60) % 360}, 70%, 80%)`
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = "#000"
      ctx.font = "12px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(
        `C:${canvas.width.toFixed(0)}x${canvas.height.toFixed(0)}`,
        canvas.width / 2,
        canvas.height / 2 - 8
      )
      ctx.fillText(
        `P:${parentWidth.toFixed(0)}x${parentHeight.toFixed(0)}`,
        canvas.width / 2,
        canvas.height / 2 + 8
      )
    }
  }, [
    index,
    isColumnLayout,
    itemsPerRow,
    aspectRatio,
    containerRef,
    calculatedCellHeight,
  ])

  // itemsPerRow変更時に再計算（タイミングを調整）
  useEffect(() => {
    // 即座に計算
    calculateAndDraw()

    // レイアウト後にも再計算（CSS gridのレイアウト完了を待つ）
    const timeoutId = setTimeout(calculateAndDraw, 0)
    const animationId = requestAnimationFrame(calculateAndDraw)

    return () => {
      clearTimeout(timeoutId)
      cancelAnimationFrame(animationId)
    }
  }, [calculateAndDraw])

  // 列レイアウト時は明示的に高さを設定
  const cellStyle = isColumnLayout
    ? {
        height: `${calculatedCellHeight}px`,
        maxHeight: `${calculatedCellHeight}px`,
        overflow: "hidden",
      }
    : {}

  // canvas の CSS サイズを明示的に設定（ピクセルバッファサイズと一致させる）
  const canvasStyle = isColumnLayout
    ? {
        width: canvasCssSize.width,
        height: canvasCssSize.height,
        flexShrink: 0,
      }
    : { width: "100%" }

  return (
    <div
      ref={parentRef}
      className="flex flex-col gap-0.5 border-2 border-gray-300 bg-white px-1 pt-1 pb-0"
      style={cellStyle}
    >
      <canvas ref={canvasRef} style={canvasStyle} />
      <div className="flex-shrink-0 truncate text-[10px] whitespace-nowrap text-gray-500">
        #{index} C:{dimensions.width.toFixed(0)}x{dimensions.height.toFixed(0)}
      </div>
    </div>
  )
}

export default function GridLayoutDebugPage() {
  const [layoutDirection, setLayoutDirection] =
    useState<LayoutDirection>("right-down")
  const [itemsPerRow, setItemsPerRow] = useState(5)
  const [itemCount, setItemCount] = useState(15)
  const [aspectRatio, setAspectRatio] = useState(2) // 横長
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const isColumnLayout =
    layoutDirection === "down-right" || layoutDirection === "down-left"

  // コンテナサイズを監視
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setContainerSize({
        width: container.offsetWidth,
        height: container.offsetHeight,
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  // 列レイアウト時のセルの高さを計算
  const gap = 4 // gap-1 = 4px
  const padding = 2 // p-0.5 = 2px
  const calculatedCellHeight = isColumnLayout
    ? (containerSize.height - padding * 2 - gap * (itemsPerRow - 1)) /
      itemsPerRow
    : 0

  const effectiveGridSize = {
    columns: isColumnLayout ? Math.ceil(itemCount / itemsPerRow) : itemsPerRow,
    rows: isColumnLayout ? itemsPerRow : Math.ceil(itemCount / itemsPerRow),
  }

  return (
    <div className="flex h-screen flex-col p-4">
      <h1 className="mb-4 text-xl font-bold">Grid Layout Debug Page</h1>

      {/* コントロールパネル */}
      <div className="mb-4 flex flex-wrap gap-4 rounded bg-gray-100 p-4">
        <div>
          <label className="block text-sm font-medium">Layout Direction</label>
          <select
            value={layoutDirection}
            onChange={(e) =>
              setLayoutDirection(e.target.value as LayoutDirection)
            }
            className="mt-1 rounded border p-2"
          >
            <option value="right-down">右→下 (Row)</option>
            <option value="left-down">左→下 (Row)</option>
            <option value="down-right">下→右 (Column)</option>
            <option value="down-left">下→左 (Column)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Items Per {isColumnLayout ? "Column" : "Row"}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={itemsPerRow}
            onChange={(e) => setItemsPerRow(Number(e.target.value))}
            className="mt-1 w-32"
          />
          <span className="ml-2">{itemsPerRow}</span>
        </div>

        <div>
          <label className="block text-sm font-medium">Item Count</label>
          <input
            type="range"
            min="1"
            max="30"
            value={itemCount}
            onChange={(e) => setItemCount(Number(e.target.value))}
            className="mt-1 w-32"
          />
          <span className="ml-2">{itemCount}</span>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Aspect Ratio (W/H)
          </label>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(Number(e.target.value))}
            className="mt-1 w-32"
          />
          <span className="ml-2">{aspectRatio.toFixed(1)}</span>
        </div>
      </div>

      {/* デバッグ情報 */}
      <div className="mb-4 rounded bg-blue-50 p-2 text-sm">
        <p>
          Container: {containerSize.width}x{containerSize.height}
        </p>
        <p>
          Grid: {effectiveGridSize.columns} cols x {effectiveGridSize.rows} rows
        </p>
        <p>isColumnLayout: {String(isColumnLayout)}</p>
        <p>calculatedCellHeight: {calculatedCellHeight.toFixed(1)}px</p>
      </div>

      {/* グリッドコンテナ */}
      <div
        ref={containerRef}
        className={`min-h-0 flex-1 border-2 border-blue-500 ${
          isColumnLayout
            ? "overflow-x-auto overflow-y-hidden"
            : "overflow-y-auto"
        }`}
      >
        <div
          className="relative grid gap-1 p-0.5 select-none"
          style={{
            gridTemplateColumns: isColumnLayout
              ? "none"
              : `repeat(${effectiveGridSize.columns}, 1fr)`,
            gridTemplateRows: isColumnLayout
              ? `repeat(${effectiveGridSize.rows}, 1fr)`
              : "none",
            gridAutoRows: "auto",
            gridAutoColumns: isColumnLayout
              ? "auto" // minmax(200px, max-content)から変更
              : undefined,
            gridAutoFlow: isColumnLayout ? "column" : "row",
            width: isColumnLayout ? "max-content" : "100%",
            height: isColumnLayout ? "100%" : "max-content",
          }}
        >
          {Array.from({ length: itemCount }, (_, i) => (
            <TestImage
              key={i}
              index={i}
              isColumnLayout={isColumnLayout}
              itemsPerRow={itemsPerRow}
              aspectRatio={aspectRatio}
              containerRef={containerRef}
              calculatedCellHeight={calculatedCellHeight}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
