"use client"

import { useEffect, useRef, useState } from "react"

import type { CropRegionWithExamPage } from "@/components/exams/07-score-at-once/types"
import { PAPER_DIMENSIONS } from "@/lib/paperSize"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

import type { DrawingElement } from "../ScoringIndividual/types/answerIndividualTypes"
import { renderTextElementV4 } from "../ScoringIndividual/utils/canvasTextRendererV4"

/**
 * 画像表示について：
 * このコンポーネントでは標準の<img>要素を使用しています。
 * Next.js Image コンポーネントを使用しない理由：
 *
 * 1. Canvas描画での直接操作が必要
 *    - 画像データを直接Canvasに描画するため、HTMLImageElementへの直接アクセスが必要
 *
 * 2. naturalWidth/naturalHeightの取得
 *    - 画像の実際のサイズ情報が必要で、Next.js Imageでは取得が困難
 *
 * 3. refの互換性問題
 *    - Next.js Imageコンポーネントのrefは実際の<img>要素を直接参照しない場合がある
 *
 * 4. onLoadイベントの確実な発火
 *    - 画像読み込み完了の検出が確実に必要
 *
 * 5. Electronアプリでの制限
 *    - Next.jsの画像最適化機能がElectronアプリで正常に動作しない場合がある
 */

interface CroppedAnswerImageProps {
  imageUrl: string
  cropRegion: CropRegionWithExamPage // not null（呼び出し元で保証）
  alt: string
  className?: string
  isColumnLayout?: boolean
  calculatedCellHeight?: number // 親から渡された計算済みセル高さ
  isSelected?: boolean
  expandMargin?: number // 表示領域拡張率 (0-50%)
  annotations?: DrawingAnnotation[] // Grid表示用アノテーション
  pageSize?: string // 用紙サイズ（mm→px変換基準）
}

// セル内の固定オフセット（padding + gap + footer）
const CELL_CONTENT_OFFSET = 32 // p-2(16px) + gap-1(4px) + footer(~12px)

// 採点領域をクロップして表示するコンポーネント
export default function CroppedAnswerImage({
  imageUrl,
  cropRegion,
  alt,
  className = "",
  isColumnLayout = false,
  calculatedCellHeight = 0,
  isSelected = false,
  expandMargin = 0,
  annotations,
  pageSize,
}: CroppedAnswerImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const imageElement = imageRef.current
    if (!canvas || !imageElement || !imageLoaded) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 表示領域拡張の計算
    const expandRatio = (expandMargin ?? 0) / 100
    const expandX = cropRegion.width * expandRatio
    const expandY = cropRegion.height * expandRatio

    // 拡張後の座標（画像端でクリップ）
    const newX = Math.max(0, cropRegion.x - expandX)
    const newY = Math.max(0, cropRegion.y - expandY)
    // 右端・下端がはみ出さないように制限
    const newWidth = Math.min(1 - newX, cropRegion.width + expandX * 2)
    const newHeight = Math.min(1 - newY, cropRegion.height + expandY * 2)

    // 採点領域のアスペクト比を計算（拡張後の領域で計算）
    const sourceWidth = newWidth * imageElement.naturalWidth
    const sourceHeight = newHeight * imageElement.naturalHeight
    const aspectRatio = sourceWidth / sourceHeight

    let canvasWidth: number
    let canvasHeight: number

    if (isColumnLayout && calculatedCellHeight > 0) {
      // 列表示: 計算済みセル高さからcanvas高さを算出
      canvasHeight = Math.max(10, calculatedCellHeight - CELL_CONTENT_OFFSET)
      canvasWidth = canvasHeight * aspectRatio
    } else {
      // 行表示: 親要素の幅を基準に計算
      const parent = canvas.parentElement
      if (!parent) return
      const containerWidth = parent.offsetWidth
      canvasWidth = Math.max(10, containerWidth)
      canvasHeight = canvasWidth / aspectRatio
    }

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    // canvas の CSS サイズを直接設定（ピクセルバッファサイズと一致させる）
    if (isColumnLayout) {
      canvas.style.width = `${canvasWidth}px`
      canvas.style.height = `${canvasHeight}px`
      canvas.style.flexShrink = "0"
    } else {
      canvas.style.width = "100%"
      canvas.style.height = ""
      canvas.style.flexShrink = ""
    }

    // 拡張後の座標でクロップして描画
    const sourceX = newX * imageElement.naturalWidth
    const sourceY = newY * imageElement.naturalHeight

    // 拡張した採点領域を直接Canvas全体に描画（アスペクト比は既に調整済み）
    ctx.drawImage(
      imageElement,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    )

    // アノテーション描画（非同期: MathJaxテキスト変換を含む）
    if (annotations && annotations.length > 0) {
      let cancelled = false
      const drawAsync = async () => {
        await drawAnnotations(
          ctx,
          annotations,
          newX,
          newY,
          newWidth,
          newHeight,
          canvas.width,
          canvas.height,
          imageElement.naturalWidth,
          imageElement.naturalHeight,
          () => cancelled,
          pageSize
        )
      }
      drawAsync()
      return () => {
        cancelled = true
      }
    }
  }, [
    imageLoaded,
    cropRegion,
    isColumnLayout,
    calculatedCellHeight,
    expandMargin,
    annotations,
    pageSize,
  ])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  // 行表示: 幅100%、高さは自動
  // 列表示: 明示的にサイズ指定（useEffect内で直接設定）
  const containerClass = isColumnLayout ? "" : "w-full"

  return (
    <div
      className={`relative ${containerClass} ${isSelected ? "ring-2 ring-blue-500 ring-inset" : ""} ${className}`}
    >
      {/* Canvas描画用の画像データ取得のため、Next.js Imageではなく通常のimgタグを使用 */}
      {}
      <img
        ref={imageRef}
        src={imageUrl}
        alt={alt}
        className="hidden"
        onLoad={handleImageLoad}
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        style={{ display: imageLoaded ? "block" : "none" }}
      />
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-xs text-gray-500">読み込み中...</div>
        </div>
      )}
    </div>
  )
}

/**
 * Grid表示用アノテーション描画
 * アノテーションの0-1相対座標をクロップ領域→Canvasピクセル座標に変換して描画
 * テキストはrenderTextElementV4を使用してMathJax対応
 */
async function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: DrawingAnnotation[],
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  imageNaturalWidth: number,
  imageNaturalHeight: number,
  isCancelled: () => boolean,
  pageSize?: string
) {
  // mm→用紙幅比率→canvasピクセルに変換するためのスケール
  // anno.strokeWidth (mm) → anno.strokeWidth / paperWidthMm → × canvasWidth / visibleWidth
  const paper = PAPER_DIMENSIONS[pageSize ?? "A4"] ?? PAPER_DIMENSIONS.A4
  const isLandscape =
    imageNaturalWidth > (imageNaturalHeight ?? imageNaturalWidth)
  const paperWidthMm = isLandscape ? paper.height : paper.width
  const scaleFactor = canvasWidth / (visibleWidth * paperWidthMm)

  for (const anno of annotations) {
    if (isCancelled()) return

    ctx.save()
    ctx.strokeStyle = anno.color
    ctx.fillStyle = anno.color
    ctx.lineWidth = Math.max(1, anno.strokeWidth * scaleFactor)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    switch (anno.type) {
      case "text":
        await drawGridTextV4(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight,
          scaleFactor
        )
        break
      case "line":
        drawGridLine(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight,
          scaleFactor
        )
        break
      case "rectangle":
        drawGridRectangle(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight
        )
        break
      case "ellipse":
        drawGridEllipse(
          ctx,
          anno,
          visibleX,
          visibleY,
          visibleWidth,
          visibleHeight,
          canvasWidth,
          canvasHeight
        )
        break
    }

    ctx.restore()
  }
}

/** 0-1相対座標→Canvasピクセル座標に変換 */
function toCanvasX(
  annoX: number,
  visibleX: number,
  visibleWidth: number,
  canvasWidth: number
): number {
  return ((annoX - visibleX) / visibleWidth) * canvasWidth
}

function toCanvasY(
  annoY: number,
  visibleY: number,
  visibleHeight: number,
  canvasHeight: number
): number {
  return ((annoY - visibleY) / visibleHeight) * canvasHeight
}

/**
 * テキスト描画（V4レンダラー使用: MathJax/SVG対応）
 * DrawingAnnotationをDrawingElementに変換し、renderTextElementV4で描画
 */
async function drawGridTextV4(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number
) {
  if (!anno.text) return

  // DrawingAnnotation → DrawingElement に変換
  // renderTextElementV4は element.x * canvasWidth でアンカーピクセル位置を計算するため、
  // Grid Canvas空間での0-1座標に変換する
  const element: DrawingElement = {
    id: `grid-${anno.id}`,
    type: "text",
    x: (anno.x - visibleX) / visibleWidth,
    y: (anno.y - visibleY) / visibleHeight,
    color: anno.color,
    strokeWidth: anno.strokeWidth,
    text: anno.text,
    fontSize: Math.max(2, anno.fontSize * scaleFactor),
    anchorDirection: anno.anchorDirection || "top-left",
  }

  await renderTextElementV4(
    ctx,
    element,
    canvasWidth,
    canvasHeight,
    false, // isSelected
    false, // showAnchor
    1.0 // opacity
  )
}

/** 線描画（全lineStyle対応） */
function drawGridLine(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  scaleFactor: number
) {
  const startX = toCanvasX(anno.x, visibleX, visibleWidth, canvasWidth)
  const startY = toCanvasY(anno.y, visibleY, visibleHeight, canvasHeight)
  const endX = toCanvasX(anno.endX, visibleX, visibleWidth, canvasWidth)
  const endY = toCanvasY(anno.endY, visibleY, visibleHeight, canvasHeight)

  const dx = endX - startX
  const dy = endY - startY
  const lineLength = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)
  const sw = Math.max(1, anno.strokeWidth * scaleFactor)
  const arrowSize = Math.max(sw * 5, 8)

  ctx.lineWidth = sw
  ctx.setLineDash([])

  switch (anno.lineStyle) {
    case "wave": {
      const waveAmplitude = sw * 3
      const waveHalfPeriod = sw * 6
      let numHalves = Math.max(Math.round(lineLength / waveHalfPeriod), 2)
      if (numHalves % 2 !== 0) numHalves++
      const perpX = -Math.sin(angle)
      const perpY = Math.cos(angle)
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      for (let i = 0; i < numHalves; i++) {
        const tMid = (i + 0.5) / numHalves
        const tEnd = (i + 1) / numHalves
        const controlAmplitude = (i % 2 === 0 ? 1 : -1) * waveAmplitude * 2
        const ctrlX = startX + dx * tMid + perpX * controlAmplitude
        const ctrlY = startY + dy * tMid + perpY * controlAmplitude
        ctx.quadraticCurveTo(
          ctrlX,
          ctrlY,
          startX + dx * tEnd,
          startY + dy * tEnd
        )
      }
      ctx.stroke()
      break
    }
    case "zigzag": {
      const zigAmplitude = sw * 3
      const zigHalfPeriod = sw * 5
      let numHalves = Math.max(Math.round(lineLength / zigHalfPeriod), 2)
      if (numHalves % 2 !== 0) numHalves++
      const perpX = -Math.sin(angle)
      const perpY = Math.cos(angle)
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      for (let i = 1; i <= numHalves; i++) {
        const t = i / numHalves
        const baseX = startX + dx * t
        const baseY = startY + dy * t
        const offset =
          i === numHalves ? 0 : i % 2 === 1 ? zigAmplitude : -zigAmplitude
        ctx.lineTo(baseX + perpX * offset, baseY + perpY * offset)
      }
      ctx.stroke()
      break
    }
    case "double": {
      const offset = sw
      const perpX = -Math.sin(angle) * offset
      const perpY = Math.cos(angle) * offset
      ctx.beginPath()
      ctx.moveTo(startX + perpX, startY + perpY)
      ctx.lineTo(endX + perpX, endY + perpY)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(startX - perpX, startY - perpY)
      ctx.lineTo(endX - perpX, endY - perpY)
      ctx.stroke()
      break
    }
    case "arrow": {
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle - Math.PI / 6),
        endY - arrowSize * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle + Math.PI / 6),
        endY - arrowSize * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fill()
      break
    }
    case "both_arrow": {
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      // 終点矢印
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle - Math.PI / 6),
        endY - arrowSize * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle + Math.PI / 6),
        endY - arrowSize * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fill()
      // 始点矢印
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(
        startX + arrowSize * Math.cos(angle - Math.PI / 6),
        startY + arrowSize * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        startX + arrowSize * Math.cos(angle + Math.PI / 6),
        startY + arrowSize * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fill()
      break
    }
    default: {
      // solid
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()
      break
    }
  }
}

/** 矩形描画 */
function drawGridRectangle(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const cx = toCanvasX(anno.x, visibleX, visibleWidth, canvasWidth)
  const cy = toCanvasY(anno.y, visibleY, visibleHeight, canvasHeight)
  const w = (anno.width / visibleWidth) * canvasWidth
  const h = (anno.height / visibleHeight) * canvasHeight
  ctx.strokeRect(cx, cy, w, h)
}

/** 楕円描画 */
function drawGridEllipse(
  ctx: CanvasRenderingContext2D,
  anno: DrawingAnnotation,
  visibleX: number,
  visibleY: number,
  visibleWidth: number,
  visibleHeight: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const cx = toCanvasX(anno.x, visibleX, visibleWidth, canvasWidth)
  const cy = toCanvasY(anno.y, visibleY, visibleHeight, canvasHeight)
  const w = (anno.width / visibleWidth) * canvasWidth
  const h = (anno.height / visibleHeight) * canvasHeight
  ctx.beginPath()
  ctx.ellipse(
    cx + w / 2,
    cy + h / 2,
    Math.abs(w) / 2,
    Math.abs(h) / 2,
    0,
    0,
    2 * Math.PI
  )
  ctx.stroke()
}
