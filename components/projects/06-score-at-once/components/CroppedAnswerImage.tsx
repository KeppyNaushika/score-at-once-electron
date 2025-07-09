"use client"

import { useEffect, useRef, useState } from "react"

interface QuestionRegion {
  id: string
  label: string
  questionNumber: string
  points: number
  x: number // 0.0 - 1.0 (画像全体に対する割合)
  y: number // 0.0 - 1.0
  width: number // 0.0 - 1.0
  height: number // 0.0 - 1.0
}

interface CroppedAnswerImageProps {
  imageUrl: string
  questionRegion: QuestionRegion // not null（呼び出し元で保証）
  alt: string
  className?: string
  isColumnLayout?: boolean
  itemsPerRow?: number // 1行あたりの表示数
  isSelected?: boolean
}

// 採点領域をクロップして表示するコンポーネント
export default function CroppedAnswerImage({
  imageUrl,
  questionRegion,
  alt,
  className = "",
  isColumnLayout = false,
  itemsPerRow,
  isSelected = false,
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

    // 採点領域のアスペクト比を計算
    const sourceWidth = questionRegion.width * imageElement.naturalWidth
    const sourceHeight = questionRegion.height * imageElement.naturalHeight
    const aspectRatio = sourceWidth / sourceHeight

    // コンテナサイズを取得
    const containerWidth = canvas.offsetWidth
    const containerHeight = canvas.offsetHeight

    // console.log(isColumnLayout, containerWidth, containerHeight, itemsPerRow)
    console.log(
      "itemsPerRow: ",
      itemsPerRow,
      "isColumnLayout: ",
      isColumnLayout,
      "containerWidth: ",
      containerWidth,
      "containerHeight: ",
      containerHeight,
      "aspectRatio: ",
      aspectRatio,
    )
    if (isColumnLayout) {
      // 列表示: 高さベースで幅を計算
      canvas.height = containerHeight
      canvas.width = containerHeight * aspectRatio
    } else {
      // 行表示: 幅ベースで高さを計算
      canvas.width = containerWidth
      canvas.height = containerWidth / aspectRatio
    }

    // 採点領域をクロップして描画
    const sourceX = questionRegion.x * imageElement.naturalWidth
    const sourceY = questionRegion.y * imageElement.naturalHeight

    // 採点領域を直接Canvas全体に描画（アスペクト比は既に調整済み）
    ctx.drawImage(
      imageElement,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  }, [imageLoaded, questionRegion, isColumnLayout, itemsPerRow])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  return (
    <div className={`relative w-full ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''} ${className}`}>
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
        className="h-full w-full"
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
