"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type QuestionRegion = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

// 採点領域をクロップして表示するコンポーネント
export const CroppedAnswerImage = ({
  imageUrl,
  questionRegion,
  alt,
  className = "",
}: {
  imageUrl: string
  questionRegion?: QuestionRegion
  alt: string
  className?: string
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const imageElement = imageRef.current
    if (!canvas || !imageElement || !imageLoaded) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // キャンバスサイズを設定
    const containerWidth = canvas.offsetWidth
    const containerHeight = canvas.offsetHeight

    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = containerWidth + "px"
    canvas.style.height = containerHeight + "px"
    ctx.scale(dpr, dpr)

    if (questionRegion) {
      // 元画像の自然サイズ
      const naturalWidth = imageElement.naturalWidth
      const naturalHeight = imageElement.naturalHeight

      // クロップする領域を計算
      const cropX = (questionRegion.x / 100) * naturalWidth
      const cropY = (questionRegion.y / 100) * naturalHeight
      const cropWidth = (questionRegion.width / 100) * naturalWidth
      const cropHeight = (questionRegion.height / 100) * naturalHeight

      try {
        ctx.drawImage(
          imageElement,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          containerWidth,
          containerHeight,
        )
      } catch (error) {
        console.error("Error drawing cropped image:", error)
        // フォールバック: 全体画像を描画
        ctx.drawImage(imageElement, 0, 0, containerWidth, containerHeight)
      }
    } else {
      // クロップ領域が指定されていない場合は全体を表示
      ctx.drawImage(imageElement, 0, 0, containerWidth, containerHeight)
    }
  }, [imageLoaded, questionRegion])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

  return (
    <div className={`relative ${className}`}>
      <img
        ref={imageRef}
        src={imageUrl}
        alt={alt}
        onLoad={handleImageLoad}
        className="hidden"
        crossOrigin="anonymous"
      />
      <canvas
        ref={canvasRef}
        className="h-full w-full object-contain"
        style={{ imageRendering: "high-quality" }}
      />
    </div>
  )
}