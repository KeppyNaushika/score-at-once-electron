import { useDrawingUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useDrawingUtils"
import { useTextRenderCache } from "./useTextRenderCache"
import { calculateOptimalFontSize } from "../utils/canvasTextRenderer"
import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"
import { useCallback, useEffect, useRef, useState } from "react"

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
  selectedElementIds: string[]
  isDrawingSelection: boolean
  selectionRectangle: any
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
  selectedElementIds,
  isDrawingSelection,
  selectionRectangle,
  showMultiplePages,
  pageSpacing,
}: UseImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([])

  const { drawLineWithStyle } = useDrawingUtils()
  // テキストレンダリングキャッシュ
  const { getCachedText, preRenderElements } = useTextRenderCache()

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

            // 設問ラベル（ズーム対応）
            ctx.fillStyle = "#22c55e"
            const labelFontSize = Math.max(12, 14 / zoom) // 最小12px、ズームで調整
            ctx.font = `${labelFontSize}px sans-serif`
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
            const isSelected = selectedElementIds.includes(element.id)
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

                    // リッチテキスト描画（html2canvas + キャッシュ）
                    ctx.setLineDash([])

                    // キャッシュされたリッチテキストを取得
                    const cachedText = getCachedText(
                      element,
                      boxWidth,
                      boxHeight,
                    )

                    if (cachedText) {
                      // キャッシュされたCanvasを描画（中央揃え）
                      const textX =
                        currentX + (boxWidth - cachedText.dimensions.width) / 2
                      const textY =
                        currentY +
                        (boxHeight - cachedText.dimensions.height) / 2
                      ctx.drawImage(cachedText.canvas, textX, textY)
                    } else {
                      // フォールバック：最適化されたシンプルテキスト描画
                      const optimalFontSize = calculateOptimalFontSize(
                        element.text,
                        boxWidth,
                        boxHeight,
                        element.fontSize || 16,
                      )

                      ctx.font = `${optimalFontSize}px sans-serif`
                      ctx.fillStyle = element.color

                      // 改行対応の描画
                      const lines = element.text.split("\n")
                      const lineHeight = optimalFontSize * 1.4
                      const totalHeight = lines.length * lineHeight
                      const startY =
                        currentY +
                        (boxHeight - totalHeight) / 2 +
                        optimalFontSize

                      lines.forEach((line, index) => {
                        const textMetrics = ctx.measureText(line)
                        const textX =
                          currentX + (boxWidth - textMetrics.width) / 2
                        const textY = startY + index * lineHeight
                        ctx.fillText(line, textX, textY)
                      })
                    }
                  } else {
                    // 通常のテキスト（改行対応）
                    ctx.font = `${element.fontSize || 16}px sans-serif`
                    ctx.fillStyle = element.color

                    const lines = element.text.split("\n")
                    const lineHeight = (element.fontSize || 16) * 1.4

                    lines.forEach((line, index) => {
                      ctx.fillText(
                        line,
                        currentX,
                        currentY + index * lineHeight,
                      )
                    })
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
              case "ellipse":
                if (
                  element.width !== undefined &&
                  element.height !== undefined
                ) {
                  const currentWidth = element.width * baseImg.naturalWidth
                  const currentHeight = element.height * baseImg.naturalHeight
                  const centerX = currentX + currentWidth / 2
                  const centerY = currentY + currentHeight / 2
                  const radiusX = Math.abs(currentWidth) / 2
                  const radiusY = Math.abs(currentHeight) / 2

                  ctx.beginPath()
                  ctx.ellipse(
                    centerX,
                    centerY,
                    radiusX,
                    radiusY,
                    0,
                    0,
                    2 * Math.PI,
                  )
                  ctx.stroke()
                }
                break
            }

            // シャドウをリセット
            if (isSelected) {
              ctx.shadowBlur = 0
            }
          })

          // 選択された要素のハンドル（編集点）を描画
          if (selectedElementIds.length > 0) {
            ctx.save()
            ctx.fillStyle = "#3b82f6" // 青色のハンドル
            ctx.strokeStyle = "#ffffff" // 白い縁取り
            ctx.lineWidth = 2

            // ズーム倍率に応じてハンドルサイズを調整（表示サイズで一定になるように）
            const baseHandleSize = 8
            const handleSize = baseHandleSize / zoom // zoomで割ることで見た目サイズを一定に
            const halfHandle = handleSize / 2

            // 複数選択の場合は全選択要素にハンドルを描画
            selectedElementIds.forEach((selectedElementId) => {
              const selectedElement = drawingElements.find(
                (el) => el.id === selectedElementId,
              )
              if (selectedElement) {
                switch (selectedElement.type) {
                  case "line":
                    if (
                      selectedElement.endX !== undefined &&
                      selectedElement.endY !== undefined
                    ) {
                      // 開始点ハンドル
                      const startX =
                        selectedElement.x * baseImg.naturalWidth + offsetX
                      const startY =
                        selectedElement.y * baseImg.naturalHeight + offsetY
                      ctx.fillRect(
                        startX - halfHandle,
                        startY - halfHandle,
                        handleSize,
                        handleSize,
                      )
                      ctx.strokeRect(
                        startX - halfHandle,
                        startY - halfHandle,
                        handleSize,
                        handleSize,
                      )

                      // 終了点ハンドル
                      const endX =
                        selectedElement.endX * baseImg.naturalWidth + offsetX
                      const endY =
                        selectedElement.endY * baseImg.naturalHeight + offsetY
                      ctx.fillRect(
                        endX - halfHandle,
                        endY - halfHandle,
                        handleSize,
                        handleSize,
                      )
                      ctx.strokeRect(
                        endX - halfHandle,
                        endY - halfHandle,
                        handleSize,
                        handleSize,
                      )
                    }
                    break
                  case "rectangle":
                    if (
                      selectedElement.width !== undefined &&
                      selectedElement.height !== undefined
                    ) {
                      const rectX =
                        selectedElement.x * baseImg.naturalWidth + offsetX
                      const rectY =
                        selectedElement.y * baseImg.naturalHeight + offsetY
                      const rectWidth =
                        selectedElement.width * baseImg.naturalWidth
                      const rectHeight =
                        selectedElement.height * baseImg.naturalHeight

                      // 4つの角にハンドルを描画
                      const corners = [
                        { x: rectX, y: rectY }, // 左上
                        { x: rectX + rectWidth, y: rectY }, // 右上
                        { x: rectX, y: rectY + rectHeight }, // 左下
                        { x: rectX + rectWidth, y: rectY + rectHeight }, // 右下
                      ]

                      corners.forEach((corner) => {
                        ctx.fillRect(
                          corner.x - halfHandle,
                          corner.y - halfHandle,
                          handleSize,
                          handleSize,
                        )
                        ctx.strokeRect(
                          corner.x - halfHandle,
                          corner.y - halfHandle,
                          handleSize,
                          handleSize,
                        )
                      })
                    }
                    break
                  case "ellipse":
                    if (
                      selectedElement.width !== undefined &&
                      selectedElement.height !== undefined
                    ) {
                      const ellipseX =
                        selectedElement.x * baseImg.naturalWidth + offsetX
                      const ellipseY =
                        selectedElement.y * baseImg.naturalHeight + offsetY
                      const ellipseWidth =
                        selectedElement.width * baseImg.naturalWidth
                      const ellipseHeight =
                        selectedElement.height * baseImg.naturalHeight

                      // 楕円の4つの角にハンドルを描画（矩形と同じ位置）
                      const corners = [
                        { x: ellipseX, y: ellipseY }, // 左上
                        { x: ellipseX + ellipseWidth, y: ellipseY }, // 右上
                        { x: ellipseX, y: ellipseY + ellipseHeight }, // 左下
                        {
                          x: ellipseX + ellipseWidth,
                          y: ellipseY + ellipseHeight,
                        }, // 右下
                      ]

                      corners.forEach((corner) => {
                        ctx.fillRect(
                          corner.x - halfHandle,
                          corner.y - halfHandle,
                          handleSize,
                          handleSize,
                        )
                        ctx.strokeRect(
                          corner.x - halfHandle,
                          corner.y - halfHandle,
                          handleSize,
                          handleSize,
                        )
                      })
                    }
                    break
                  case "text":
                    if (
                      selectedElement.textBoxWidth !== undefined &&
                      selectedElement.textBoxHeight !== undefined
                    ) {
                      const textX =
                        selectedElement.x * baseImg.naturalWidth + offsetX
                      const textY =
                        selectedElement.y * baseImg.naturalHeight + offsetY
                      const textWidth =
                        selectedElement.textBoxWidth * baseImg.naturalWidth
                      const textHeight =
                        selectedElement.textBoxHeight * baseImg.naturalHeight

                      // テキストボックスの4つの角にハンドル
                      const corners = [
                        { x: textX, y: textY }, // 左上
                        { x: textX + textWidth, y: textY }, // 右上
                        { x: textX, y: textY + textHeight }, // 左下
                        { x: textX + textWidth, y: textY + textHeight }, // 右下
                      ]

                      corners.forEach((corner) => {
                        ctx.fillRect(
                          corner.x - halfHandle,
                          corner.y - halfHandle,
                          handleSize,
                          handleSize,
                        )
                        ctx.strokeRect(
                          corner.x - halfHandle,
                          corner.y - halfHandle,
                          handleSize,
                          handleSize,
                        )
                      })
                    }
                    break
                }
              }
            })
            ctx.restore()
          }

          // 現在描画中の要素（リアルタイムプレビュー）
          if (isDrawing && currentDrawing) {
            const currentX =
              (currentDrawing.x || 0) * baseImg.naturalWidth + offsetX
            const currentY =
              (currentDrawing.y || 0) * baseImg.naturalHeight + offsetY

            ctx.save()
            ctx.strokeStyle = currentDrawing.color || strokeColor
            ctx.lineWidth = currentDrawing.strokeWidth || strokeWidth
            ctx.globalAlpha = 0.8 // 少し透明にしてプレビュー感を演出
            ctx.lineCap = "round"
            ctx.setLineDash([])

            switch (currentDrawing.type) {
              case "line":
                if (
                  currentDrawing.endX !== undefined &&
                  currentDrawing.endY !== undefined
                ) {
                  const currentEndX =
                    currentDrawing.endX * baseImg.naturalWidth + offsetX
                  const currentEndY =
                    currentDrawing.endY * baseImg.naturalHeight + offsetY

                  ctx.beginPath()
                  ctx.moveTo(currentX, currentY)
                  ctx.lineTo(currentEndX, currentEndY)
                  ctx.stroke()
                }
                break
              case "rectangle":
                if (
                  currentDrawing.width !== undefined &&
                  currentDrawing.height !== undefined
                ) {
                  const currentWidth =
                    currentDrawing.width * baseImg.naturalWidth
                  const currentHeight =
                    currentDrawing.height * baseImg.naturalHeight
                  ctx.strokeRect(
                    currentX,
                    currentY,
                    currentWidth,
                    currentHeight,
                  )
                }
                break
              case "ellipse":
                if (
                  currentDrawing.width !== undefined &&
                  currentDrawing.height !== undefined
                ) {
                  const currentWidth =
                    currentDrawing.width * baseImg.naturalWidth
                  const currentHeight =
                    currentDrawing.height * baseImg.naturalHeight
                  const centerX = currentX + currentWidth / 2
                  const centerY = currentY + currentHeight / 2
                  const radiusX = Math.abs(currentWidth) / 2
                  const radiusY = Math.abs(currentHeight) / 2

                  ctx.beginPath()
                  ctx.ellipse(
                    centerX,
                    centerY,
                    radiusX,
                    radiusY,
                    0,
                    0,
                    2 * Math.PI,
                  )
                  ctx.stroke()
                }
                break
              case "text":
                if (
                  isCreatingTextBox &&
                  currentDrawing.textBoxWidth !== undefined &&
                  currentDrawing.textBoxHeight !== undefined
                ) {
                  // テキストボックス作成中のプレビュー表示
                  const currentWidth =
                    currentDrawing.textBoxWidth * baseImg.naturalWidth
                  const currentHeight =
                    currentDrawing.textBoxHeight * baseImg.naturalHeight

                  ctx.strokeStyle = currentDrawing.color || strokeColor
                  ctx.lineWidth = 2
                  ctx.setLineDash([5, 5])
                  ctx.strokeRect(
                    currentX,
                    currentY,
                    currentWidth,
                    currentHeight,
                  )

                  // "Text Box" プレビューテキスト（ズーム対応）
                  ctx.setLineDash([])
                  const previewFontSize = Math.max(12, 16 / zoom) // 最小12px、ズームで調整
                  ctx.font = `${previewFontSize}px sans-serif`
                  ctx.fillStyle = currentDrawing.color || strokeColor
                  ctx.globalAlpha = 0.6
                  const textOffset = Math.max(3, 5 / zoom) // テキストオフセットもズーム対応
                  ctx.fillText(
                    "Text Box",
                    currentX + textOffset,
                    currentY + textOffset * 4,
                  )
                }
                break
            }
            ctx.restore()
          }

          // 選択範囲矩形の描画
          if (isDrawingSelection && selectionRectangle) {
            ctx.save()
            ctx.strokeStyle = "#2563eb" // 青色の選択範囲
            ctx.setLineDash([5, 5]) // 点線
            ctx.lineWidth = 1
            ctx.globalAlpha = 0.6

            const rectX = selectionRectangle.x * baseImg.naturalWidth + offsetX
            const rectY = selectionRectangle.y * baseImg.naturalHeight + offsetY
            const rectWidth = selectionRectangle.width * baseImg.naturalWidth
            const rectHeight = selectionRectangle.height * baseImg.naturalHeight

            ctx.strokeRect(rectX, rectY, rectWidth, rectHeight)

            // 選択範囲の背景（薄い青色）
            ctx.fillStyle = "#2563eb"
            ctx.globalAlpha = 0.1
            ctx.fillRect(rectX, rectY, rectWidth, rectHeight)

            ctx.restore()
          }
        }
      }
    },
    [
      pageSpacing,
      currentCropRegion,
      zoom,
      drawingElements,
      selectedElementIds,
      isDrawing,
      currentDrawing,
      isDrawingSelection,
      selectionRectangle,
      getCachedText,
      drawLineWithStyle,
      strokeColor,
      strokeWidth,
      isCreatingTextBox,
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
            naturalHeight: firstImage.naturalHeight,
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
              naturalHeight: firstImage.naturalHeight,
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
  }, [currentScoringData, drawCanvas, pageImages, showMultiplePages])

  // Canvas再描画（全ての要素を統合）
  useEffect(() => {
    if (imageLoaded && loadedImages.length > 0) {
      drawCanvas(loadedImages)
    }
  }, [imageLoaded, loadedImages, drawCanvas])

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

  // テキスト要素の事前レンダリング（キャッシュ生成）
  useEffect(() => {
    if (imageLoaded && loadedImages.length > 0 && drawingElements.length > 0) {
      const baseImg = loadedImages[0]
      if (baseImg) {
        // テキスト要素のみを抽出して事前レンダリング
        preRenderElements(
          drawingElements,
          baseImg.naturalWidth,
          baseImg.naturalHeight,
        ).catch((error) => {
          console.warn("Text pre-rendering failed:", error)
        })
      }
    }
  }, [drawingElements, imageLoaded, loadedImages, preRenderElements])

  return {
    canvasRef,
    imageRef,
    containerRef,
    imageLoaded,
    loadedImages,
  }
}
