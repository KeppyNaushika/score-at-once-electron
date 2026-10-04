"use client"

import type React from "react"

import type { CanvasTool } from "./types"

interface AnswerCanvasStackProps {
  /** スクロールするコンテナに付ける ref（コールバック ref） */
  containerRef: (element: HTMLDivElement | null) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  textCanvasRef: React.RefObject<HTMLCanvasElement | null>
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>
  /** 答案コンテンツの自然サイズ（ズーム前、ピクセル単位） */
  naturalWidth: number
  naturalHeight: number
  zoom: number
  currentTool: CanvasTool
  isDraggingElement: boolean
  onPointerDown: React.PointerEventHandler<HTMLCanvasElement>
  onPointerMove: React.PointerEventHandler<HTMLCanvasElement>
  onPointerUp: React.PointerEventHandler<HTMLCanvasElement>
  /** キャンバスの上に重ねるもの（模範解答の重ね表示） */
  children?: React.ReactNode
}

/**
 * 答案のスクロール領域と、重ねた3枚のキャンバス
 * - メイン（画像・描画要素。ポインター操作はここが受ける）
 * - テキスト専用
 * - オーバーレイ（ハンドル表示専用）
 *
 * CSS スクロール + scale 方式。キャンバスの解像度は自然サイズのまま、表示だけズーム倍にする
 */
export function AnswerCanvasStack({
  containerRef,
  canvasRef,
  textCanvasRef,
  overlayCanvasRef,
  naturalWidth,
  naturalHeight,
  zoom,
  currentTool,
  isDraggingElement,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  children,
}: AnswerCanvasStackProps) {
  // 3枚のキャンバスは同じ大きさで重なる
  const displaySize = {
    width: `${naturalWidth * zoom}px`,
    height: `${naturalHeight * zoom}px`,
  }

  return (
    <div
      ref={containerRef}
      className="grid h-full w-full overflow-auto"
      style={{
        cursor:
          currentTool === "hand"
            ? isDraggingElement
              ? "grabbing"
              : "grab"
            : currentTool === "select"
              ? isDraggingElement
                ? "move"
                : "default"
              : "crosshair",
      }}
    >
      <div
        className="relative grid place-items-center"
        style={{
          ...displaySize,
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
        {/* メインキャンバス（画像・描画要素） */}
        <canvas
          ref={canvasRef}
          width={naturalWidth}
          height={naturalHeight}
          className="absolute top-0 left-0 block"
          style={{
            ...displaySize,
            imageRendering: "pixelated", // 拡大時のぼけを防止
            transform: "translateZ(0)", // ハードウェアアクセラレーション有効化
            touchAction: "none", // ポインターイベント用タッチアクション無効化
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {/* テキスト専用キャンバス */}
        <canvas
          ref={textCanvasRef}
          width={naturalWidth}
          height={naturalHeight}
          className="pointer-events-none absolute top-0 left-0 block"
          style={{
            ...displaySize,
            imageRendering: "pixelated",
            transform: "translateZ(0)",
          }}
        />
        {/* オーバーレイキャンバス（ハンドル表示専用） */}
        <canvas
          ref={overlayCanvasRef}
          width={naturalWidth}
          height={naturalHeight}
          className="pointer-events-none absolute top-0 left-0 block"
          style={{
            ...displaySize,
            imageRendering: "pixelated",
            transform: "translateZ(0)",
          }}
        />
        {children}
      </div>
    </div>
  )
}
