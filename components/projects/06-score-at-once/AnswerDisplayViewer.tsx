"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Maximize2,
  MousePointer,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

// 答案表示の型定義
interface AnswerSheet {
  id: string
  studentId: string
  imagePath: string
  pageNumber: number
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
  }
}

// 設問領域の型定義
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

interface AnswerDisplayViewerProps {
  answerSheet: AnswerSheet
  currentQuestion?: QuestionRegion
  viewMode: "question" | "full" // 設問拡大 or 全体表示
  zoom: number
  position: { x: number; y: number }
  onZoomChange: (zoom: number) => void
  onPositionChange: (position: { x: number; y: number }) => void
  onViewModeChange: (mode: "question" | "full") => void
}

export default function AnswerDisplayViewer({
  answerSheet,
  currentQuestion,
  viewMode,
  zoom,
  position,
  onZoomChange,
  onPositionChange,
  onViewModeChange,
}: AnswerDisplayViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragMode, setDragMode] = useState(false) // ドラッグモードの切り替え

  // 画像の読み込み
  useEffect(() => {
    
    if (!answerSheet?.imagePath) {
      console.warn("AnswerDisplayViewer: No image path provided")
      return
    }

    const img = new Image()
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight })
      setImageLoaded(true)
      drawCanvas(img)
    }
    img.onerror = (error) => {
      console.error("Failed to load image:", {
        answerSheetId: answerSheet.id,
        studentId: answerSheet.studentId,
        originalPath: answerSheet.imagePath,
        finalSrc: img.src,
        error
      })
      setImageLoaded(false)
    }

    // Electronの場合、appimg プロトコルを使用
    img.src = answerSheet.imagePath.startsWith("appimg://")
      ? answerSheet.imagePath
      : `appimg://${answerSheet.imagePath}`

    if (imageRef.current) {
      imageRef.current = img
    }
  }, [answerSheet?.imagePath])

  // キャンバスの描画
  const drawCanvas = useCallback(
    (img?: HTMLImageElement) => {
      const canvas = canvasRef.current
      const image = img || imageRef.current
      if (!canvas || !image || !imageLoaded) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const container = containerRef.current
      if (!container) return

      // コンテナサイズに合わせてキャンバスサイズを設定
      const containerRect = container.getBoundingClientRect()
      canvas.width = containerRect.width
      canvas.height = containerRect.height

      // キャンバスをクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let displayX = position.x
      let displayY = position.y
      let displayWidth = image.naturalWidth * zoom
      let displayHeight = image.naturalHeight * zoom

      // 設問モードの場合、設問領域にフォーカス
      if (viewMode === "question" && currentQuestion) {
        const questionX = currentQuestion.x * image.naturalWidth
        const questionY = currentQuestion.y * image.naturalHeight
        const questionWidth = currentQuestion.width * image.naturalWidth
        const questionHeight = currentQuestion.height * image.naturalHeight

        // 設問領域が画面中央に来るように調整
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2

        displayX = centerX - (questionX + questionWidth / 2) * zoom
        displayY = centerY - (questionY + questionHeight / 2) * zoom
      }

      // 画像を描画
      ctx.drawImage(image, displayX, displayY, displayWidth, displayHeight)

      // 設問領域のハイライト表示
      if (currentQuestion && viewMode === "full") {
        const regionX = displayX + currentQuestion.x * displayWidth
        const regionY = displayY + currentQuestion.y * displayHeight
        const regionWidth = currentQuestion.width * displayWidth
        const regionHeight = currentQuestion.height * displayHeight

        // 設問領域を赤枠でハイライト
        ctx.strokeStyle = "#ef4444"
        ctx.lineWidth = 3
        ctx.setLineDash([])
        ctx.strokeRect(regionX, regionY, regionWidth, regionHeight)

        // 設問番号を表示
        ctx.fillStyle = "#ef4444"
        ctx.font = "16px sans-serif"
        ctx.fillText(
          `設問${currentQuestion.questionNumber}`,
          regionX + 5,
          regionY - 5,
        )
      }
    },
    [imageLoaded, zoom, position, viewMode, currentQuestion],
  )

  // 描画の更新
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // マウス操作（パン機能）
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!dragMode) return

      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    },
    [dragMode, position],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragMode) return

      const newPosition = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }
      onPositionChange(newPosition)
    },
    [isDragging, dragMode, dragStart, onPositionChange],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ホイールズーム
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(zoom * zoomDelta, 0.1), 5.0)
      onZoomChange(newZoom)
    },
    [zoom, onZoomChange],
  )

  // ズーム操作
  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.2, 5.0)
    onZoomChange(newZoom)
  }

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.2, 0.1)
    onZoomChange(newZoom)
  }

  const handleResetZoom = () => {
    onZoomChange(1.0)
    onPositionChange({ x: 0, y: 0 })
  }

  const toggleViewMode = () => {
    const newMode = viewMode === "question" ? "full" : "question"
    onViewModeChange(newMode)
    // ビューモード変更時はズームと位置をリセット
    onZoomChange(1.0)
    onPositionChange({ x: 0, y: 0 })
  }

  return (
    <div className="relative h-full w-full bg-gray-50" ref={containerRef}>
      {/* キャンバス表示エリア */}
      <canvas
        ref={canvasRef}
        className={`h-full w-full ${dragMode ? "cursor-move" : "cursor-default"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* 画像が読み込まれていない場合 */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="text-muted-foreground text-sm">画像を読み込み中...</p>
          </div>
        </div>
      )}

      {/* 操作コントロール */}
      <div className="absolute top-4 right-4 space-y-2">
        <Card className="p-2">
          <div className="space-y-1">
            {/* ズーム操作 */}
            <div className="flex flex-col space-y-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomIn}
                title="拡大 (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleZoomOut}
                title="縮小 (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetZoom}
                title="リセット (0)"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <hr className="my-2" />

            {/* ビューモード切り替え */}
            <Button
              size="sm"
              variant={viewMode === "full" ? "default" : "outline"}
              onClick={toggleViewMode}
              title="全体/設問表示切り替え (F)"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            {/* ドラッグモード切り替え */}
            <Button
              size="sm"
              variant={dragMode ? "default" : "outline"}
              onClick={() => setDragMode(!dragMode)}
              title="ドラッグモード切り替え"
            >
              {dragMode ? (
                <Move className="h-4 w-4" />
              ) : (
                <MousePointer className="h-4 w-4" />
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* 情報表示 */}
      <div className="absolute bottom-4 left-4">
        <Card className="p-2">
          <div className="text-muted-foreground space-y-1 text-xs">
            <div>ズーム: {Math.round(zoom * 100)}%</div>
            <div>
              モード: {viewMode === "question" ? "設問表示" : "全体表示"}
            </div>
            {currentQuestion && (
              <div>
                設問: {currentQuestion.questionNumber} ({currentQuestion.points}
                点)
              </div>
            )}
            <div className="text-xs text-gray-400">
              ホイール: ズーム | ドラッグ: パン
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
