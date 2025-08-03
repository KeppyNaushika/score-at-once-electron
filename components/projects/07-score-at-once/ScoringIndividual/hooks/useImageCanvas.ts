import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"
import { useCallback, useEffect, useRef, useState } from "react"
import type { DrawingElement } from "../types/answer-individual-types"
import { useDrawingUtils } from "./useDrawingUtils"

interface UseImageCanvasProps {
  currentScoringData: ScoringData | null
  currentCropRegion?: CropRegionWithProjectPage | null
  pageImages?: PageImageWithProjectStudents[]
  zoom: number
  position: { x: number; y: number }
  drawingElements: DrawingElement[]
  currentDrawing: Partial<DrawingElement> | null
  isDrawing: boolean
  isCreatingTextBox: boolean
  strokeColor: string
  strokeWidth: number
  lineStyle: string
  isShiftPressed: boolean
  selectedElementId: string | null
  showMultiplePages?: boolean
  pageSpacing?: number
}

export function useImageCanvas({
  currentScoringData,
  currentCropRegion,
  pageImages,
  zoom,
  position,
  drawingElements,
  currentDrawing,
  isDrawing,
  isCreatingTextBox,
  strokeColor,
  strokeWidth,
  lineStyle,
  isShiftPressed,
  selectedElementId,
  showMultiplePages,
  pageSpacing,
}: UseImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([])

  const { drawLineWithStyle } = useDrawingUtils()


  // Canvas描画処理（CSS scale + scroll 方式）
  const drawCanvas = useCallback(
    (images: HTMLImageElement[]) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      if (images.length === 0) return

      // キャンバスサイズを最初の画像サイズに固定（CSS scaleが拡大を担当）
      const firstImg = images[0]
      const canvasWidth = firstImg.naturalWidth
      const totalHeight = images.reduce(
        (total, img, index) =>
          total +
          img.naturalHeight +
          (index < images.length - 1 ? pageSpacing || 20 : 0),
        0,
      )

      // Canvas内部解像度の設定
      canvas.width = canvasWidth
      canvas.height = totalHeight
      
      // Canvas size debug removed for cleaner output

      // 画像描画をクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // デバッグ: Canvas可視化のため薄い背景色を設定
      ctx.fillStyle = "rgba(255, 255, 0, 0.1)" // 薄い黄色
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Canvas Context設定を強制リセット
      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1.0
      ctx.lineCap = "butt"
      ctx.lineJoin = "miter"
      ctx.miterLimit = 10
      ctx.setLineDash([])

      // 常に複数ページ表示処理（1ページでも縦並び表示として扱う）
      let currentY = 0
      const spacing = pageSpacing || 20

      images.forEach((img, index) => {
        // 画像を Canvas幅の中央に配置
        const offsetX = (canvasWidth - img.naturalWidth) / 2
        const offsetY = currentY

        // 画像描画（純粋等倍描画、拡大はCSSが担当）
        ctx.drawImage(img, offsetX, offsetY)

        // ページ間の境界線（複数ページの場合のみ）
        if (images.length > 1 && index < images.length - 1) {
          ctx.strokeStyle = "#e5e7eb"
          ctx.lineWidth = 1
          ctx.setLineDash([5, 5])
          const borderY = offsetY + img.naturalHeight + spacing / 2
          ctx.beginPath()
          ctx.moveTo(0, borderY)
          ctx.lineTo(canvas.width, borderY)
          ctx.stroke()
          ctx.setLineDash([])
        }

        currentY += img.naturalHeight + (images.length > 1 ? spacing : 0)
      })


      // 設問枠描画（CSS scale方式）
      if (currentCropRegion && images.length > 0) {
        // 設問が属するページを特定（pageNumberから0ベースのインデックスに変換）
        const questionPageNumber =
          currentCropRegion.projectPage?.pageNumber || 1
        const questionPageIndex = questionPageNumber - 1 // 1ベース→0ベースに変換

        // 指定されたページが読み込まれた画像の範囲内かチェック
        if (questionPageIndex >= 0 && questionPageIndex < images.length) {
          const img = images[questionPageIndex]

          if (img) {
            // 設問位置計算（指定ページまでのオフセットを計算）
            const spacing = pageSpacing || 20
            let pageOffsetY = 0
            for (let i = 0; i < questionPageIndex; i++) {
              pageOffsetY +=
                images[i].naturalHeight + (images.length > 1 ? spacing : 0)
            }

            // 画像の中央配置に合わせてオフセット調整（Canvas幅基準）
            const offsetX = (canvasWidth - img.naturalWidth) / 2
            const offsetY = pageOffsetY

            const questionX = currentCropRegion.x * img.naturalWidth + offsetX
            const questionY = currentCropRegion.y * img.naturalHeight + offsetY
            const questionWidth = currentCropRegion.width * img.naturalWidth
            const questionHeight = currentCropRegion.height * img.naturalHeight


            ctx.strokeStyle = "#22c55e"
            ctx.lineWidth = 2
            ctx.setLineDash([])
            ctx.strokeRect(questionX, questionY, questionWidth, questionHeight)

            // 設問ラベル
            ctx.fillStyle = "#22c55e"
            ctx.font = "14px sans-serif"
            ctx.fillText(currentCropRegion.label, questionX, questionY - 5)
          }
        } else {
          console.warn("設問のページが読み込まれた画像の範囲外です:", {
            questionPageIndex,
            totalPages: images.length,
          })
        }
      }

      // 描画要素の描画（CSS scale方式）
      if (images.length > 0) {
        const baseImg = images[0]
        if (baseImg) {
          // 画像の中央配置に合わせてオフセット調整
          const offsetX = (canvasWidth - baseImg.naturalWidth) / 2
          const offsetY = 0

          drawingElements.forEach((element) => {
            const currentX = element.x * baseImg.naturalWidth + offsetX
            const currentY = element.y * baseImg.naturalHeight + offsetY

            ctx.strokeStyle = element.color
            ctx.fillStyle = element.color
            ctx.lineWidth = element.strokeWidth

            // 選択中の要素をハイライト
            const isSelected = element.id === selectedElementId
            if (isSelected) {
              ctx.shadowColor = element.color
              ctx.shadowBlur = 10
            }

            switch (element.type) {
              case "text":
                if (element.text) {
                  if (
                    element.textBoxWidth !== undefined &&
                    element.textBoxHeight !== undefined
                  ) {
                    // テキストボックス（CSS scale方式）
                    const boxWidth = element.textBoxWidth * baseImg.naturalWidth
                    const boxHeight =
                      element.textBoxHeight * baseImg.naturalHeight

                    // ボックス枠描画
                    if (isSelected) {
                      ctx.strokeStyle = element.color
                      ctx.lineWidth = 1
                      ctx.setLineDash([3, 3])
                      ctx.strokeRect(currentX, currentY, boxWidth, boxHeight)
                    }

                    // テキスト描画（ボックスに合わせてスケール）
                    ctx.setLineDash([])
                    const scaleFactor = Math.min(
                      boxWidth / (element.text.length * 10),
                      boxHeight / 20,
                    )
                    const actualFontSize = Math.max(
                      12,
                      (element.fontSize || 16) * scaleFactor,
                    )
                    ctx.font = `${actualFontSize}px sans-serif`

                    // テキストを中央揃えで描画
                    const textMetrics = ctx.measureText(element.text)
                    const textX = currentX + (boxWidth - textMetrics.width) / 2
                    const textY = currentY + boxHeight / 2 + actualFontSize / 3
                    ctx.fillText(element.text, textX, textY)
                  } else {
                    // 通常のテキスト
                    ctx.font = `${element.fontSize || 16}px sans-serif`
                    ctx.fillText(element.text, currentX, currentY)
                  }
                }
                break
              case "line":
                if (element.endX !== undefined && element.endY !== undefined) {
                  const currentEndX =
                    element.endX * baseImg.naturalWidth + offsetX
                  const currentEndY =
                    element.endY * baseImg.naturalHeight + offsetY

                  // 通常の自由線
                  drawLineWithStyle(
                    ctx,
                    currentX,
                    currentY,
                    currentEndX,
                    currentEndY,
                    (element.lineStyle || "solid") as any,
                    element.strokeWidth,
                  )
                }
                break
              case "rectangle":
                if (
                  element.width !== undefined &&
                  element.height !== undefined
                ) {
                  const currentWidth = element.width * baseImg.naturalWidth
                  const currentHeight = element.height * baseImg.naturalHeight
                  ctx.strokeRect(
                    currentX,
                    currentY,
                    currentWidth,
                    currentHeight,
                  )
                }
                break
            }

            // シャドウをリセット
            if (isSelected) {
              ctx.shadowBlur = 0
            }
          })

          // 現在描画中の要素（描画頻度を制限）
          if (isDrawing && currentDrawing) {
            const currentX = (currentDrawing.x || 0) * baseImg.naturalWidth + offsetX
            const currentY = (currentDrawing.y || 0) * baseImg.naturalHeight + offsetY

            ctx.save()
            ctx.strokeStyle = "#ff0000" // 強制的に赤色で確認
            ctx.lineWidth = 5
            ctx.globalAlpha = 1
            ctx.lineCap = "round"
            ctx.setLineDash([])

            switch (currentDrawing.type) {
              case "line":
                if (currentDrawing.endX !== undefined && currentDrawing.endY !== undefined) {
                  const currentEndX = currentDrawing.endX * baseImg.naturalWidth + offsetX
                  const currentEndY = currentDrawing.endY * baseImg.naturalHeight + offsetY

                  ctx.beginPath()
                  ctx.moveTo(currentX, currentY)
                  ctx.lineTo(currentEndX, currentEndY)
                  ctx.stroke()

                  // Line drawing confirmed
                }
                break
            }
            ctx.restore()
          }
        }
      }
    },
    [
      pageSpacing,
      currentCropRegion,
      drawingElements,
      selectedElementId,
      drawLineWithStyle,
      strokeColor,
      strokeWidth,
      isCreatingTextBox,
      // isDrawing と currentDrawing は描画パフォーマンス最適化のため部分的に処理
    ],
  )

  // 画像読み込み処理（Grid Viewと同じロジックを使用）
  useEffect(() => {
    const loadAnswerImages = async () => {
      if (!currentScoringData) {
        console.warn("AnswerIndividualView: No currentScoringData provided")
        setImageLoaded(false)
        return
      }

      let imagesToLoad: { path: string; pageNumber: number }[] = []

      if (showMultiplePages && pageImages) {
        // 複数ページ表示：同一生徒の全ページを取得
        const studentAnswerSheets = pageImages
          .filter((sheet) => sheet.studentId === currentScoringData.studentId)
          .sort(
            (a, b) =>
              (a.projectPage?.pageNumber || 1) -
              (b.projectPage?.pageNumber || 1),
          )

        imagesToLoad = studentAnswerSheets.map((sheet) => ({
          path: sheet.imagePath,
          pageNumber: sheet.projectPage?.pageNumber || 1,
        }))
      } else {
        // 単一ページ表示：ScoringDataのimageUrlを使用（Grid Viewと同じ）
        const imagePath = currentScoringData.imageUrl.replace("appimg://", "")
        imagesToLoad = [{ path: imagePath, pageNumber: 1 }]
      }

      // 画像を並列読み込み
      const loadPromises = imagesToLoad.map(async (imageInfo) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image()

          img.onload = () => resolve(img)
          img.onerror = (error) => {
            console.error(
              `Failed to load image for page ${imageInfo.pageNumber}:`,
              error,
            )
            reject(error)
          }

          // ファイル存在確認して読み込み
          window.electronAPI
            .checkFileExists(imageInfo.path)
            .then((result) => {
              if (result.success && result.exists) {
                img.src = `file://${result.path}`
              } else {
                console.warn(`File does not exist: ${imageInfo.path}`)
                reject(new Error(`File not found: ${imageInfo.path}`))
              }
            })
            .catch((error) => {
              console.error("Error checking file existence:", error)
              img.src = `file://${imageInfo.path}` // フォールバック
            })
        })
      })

      try {
        const loadedImageArray = await Promise.all(loadPromises)
        setLoadedImages(loadedImageArray)
        setImageLoaded(true)
        
        // 隠しimg要素に最初の画像のsrcを設定（座標計算用）
        if (loadedImageArray.length > 0 && imageRef.current) {
          const firstImage = loadedImageArray[0]
          imageRef.current.src = firstImage.src
          console.log("🖼️ Setting hidden img src:", {
            src: firstImage.src,
            naturalWidth: firstImage.naturalWidth,
            naturalHeight: firstImage.naturalHeight
          })
        }
        
        drawCanvas(loadedImageArray)
      } catch (error) {
        console.error("Failed to load some images:", error)
        // 部分的に読み込めた画像があれば表示
        const partialResults = await Promise.allSettled(loadPromises)
        const successfulImages = partialResults
          .filter(
            (result): result is PromiseFulfilledResult<HTMLImageElement> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value)

        if (successfulImages.length > 0) {
          setLoadedImages(successfulImages)
          setImageLoaded(true)
          
          // 隠しimg要素に最初の画像のsrcを設定（部分読み込みの場合）
          if (successfulImages.length > 0 && imageRef.current) {
            const firstImage = successfulImages[0]
            imageRef.current.src = firstImage.src
            console.log("🖼️ Setting hidden img src (partial load):", {
              src: firstImage.src,
              naturalWidth: firstImage.naturalWidth,
              naturalHeight: firstImage.naturalHeight
            })
          }
          
          drawCanvas(successfulImages)
        } else {
          setImageLoaded(false)
        }
      }
    }

    if (currentScoringData) {
      loadAnswerImages()
    }
  }, [currentScoringData, pageImages, showMultiplePages]) // drawCanvasを依存配列から除外

  // Canvas再描画（ベース要素のみ）
  useEffect(() => {
    if (imageLoaded && loadedImages.length > 0) {
      drawCanvas(loadedImages)
    }
  }, [imageLoaded, loadedImages, drawingElements, selectedElementId, strokeColor, strokeWidth, isCreatingTextBox])

  // 現在描画中の要素の軽量更新（全体再描画を避ける）
  useEffect(() => {
    if (imageLoaded && loadedImages.length > 0 && isDrawing && currentDrawing) {
      // 最後の描画から短時間の場合はスキップ（デバウンス効果）
      const timeoutId = setTimeout(() => {
        drawCanvas(loadedImages)
      }, 16) // 60FPS相当の制限
      
      return () => clearTimeout(timeoutId)
    }
  }, [imageLoaded, loadedImages, isDrawing, currentDrawing])

  // コンテナリサイズの監視とCanvas再描画
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      if (imageLoaded && loadedImages.length > 0) {
        drawCanvas(loadedImages)
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [imageLoaded, loadedImages, drawCanvas])

  return {
    canvasRef,
    imageRef,
    containerRef,
    imageLoaded,
    loadedImages,
  }
}
