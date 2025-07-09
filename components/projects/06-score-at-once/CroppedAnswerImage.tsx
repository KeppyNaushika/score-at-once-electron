"use client"

import { useState, useCallback, useEffect, useRef } from "react"

interface QuestionRegion {
  id: string
  label: string
  questionNumber: string
  points: number
  x: number
  y: number
  width: number
  height: number
}

interface CroppedAnswerImageProps {
  imageUrl: string
  questionRegion?: QuestionRegion
  alt: string
  className?: string
  isSelected?: boolean
}

export function CroppedAnswerImage({ 
  imageUrl, 
  questionRegion, 
  alt, 
  className = "",
  isSelected = false
}: CroppedAnswerImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const imageElement = imageRef.current
    if (!canvas || !imageElement || !imageLoaded) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // キャンバスサイズを設定
    const containerWidth = canvas.offsetWidth
    const containerHeight = canvas.offsetHeight
    canvas.width = containerWidth
    canvas.height = containerHeight

    if (questionRegion) {
      // 採点領域をクロップして描画
      const sourceX = questionRegion.x * imageElement.naturalWidth
      const sourceY = questionRegion.y * imageElement.naturalHeight
      const sourceWidth = questionRegion.width * imageElement.naturalWidth
      const sourceHeight = questionRegion.height * imageElement.naturalHeight

      // アスペクト比を維持してキャンバスに描画
      const scaleX = containerWidth / sourceWidth
      const scaleY = containerHeight / sourceHeight
      const scale = Math.min(scaleX, scaleY)

      const destWidth = sourceWidth * scale
      const destHeight = sourceHeight * scale
      const destX = (containerWidth - destWidth) / 2
      const destY = (containerHeight - destHeight) / 2

      ctx.clearRect(0, 0, containerWidth, containerHeight)
      ctx.drawImage(
        imageElement,
        sourceX, sourceY, sourceWidth, sourceHeight,
        destX, destY, destWidth, destHeight
      )
    } else {
      // 全体画像を表示
      const scaleX = containerWidth / imageElement.naturalWidth
      const scaleY = containerHeight / imageElement.naturalHeight
      const scale = Math.min(scaleX, scaleY)

      const destWidth = imageElement.naturalWidth * scale
      const destHeight = imageElement.naturalHeight * scale
      const destX = (containerWidth - destWidth) / 2
      const destY = (containerHeight - destHeight) / 2

      ctx.clearRect(0, 0, containerWidth, containerHeight)
      ctx.drawImage(imageElement, destX, destY, destWidth, destHeight)
    }
  }, [imageLoaded, questionRegion])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Failed to load image:', imageUrl, e)
    setImageLoaded(false)
  }, [imageUrl])

  return (
    <div className={`relative ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''} ${className}`}>
      <img
        ref={imageRef}
        src={imageUrl}
        alt={alt}
        className="hidden"
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: imageLoaded ? 'block' : 'none' }}
      />
      {!imageLoaded && (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <span className="text-gray-500 text-sm">読み込み中...</span>
        </div>
      )}
    </div>
  )
}