"use client"

import { useEffect, useRef, useState } from "react"

import type { CropRegionWithExamPage } from "@/components/exams/07-score-at-once/types"

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
  }, [
    imageLoaded,
    cropRegion,
    isColumnLayout,
    calculatedCellHeight,
    expandMargin,
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
