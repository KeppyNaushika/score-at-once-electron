import { useCallback, useEffect, useRef, useState } from "react"
import type {
  StudentAnswer,
  QuestionRegion,
  DrawingElement,
} from "../types/answer-individual-types"
import { useDrawingUtils } from "./useDrawingUtils"

interface UseImageCanvasProps {
  answerSheet: StudentAnswer
  currentQuestion?: QuestionRegion
  allAnswerSheets?: StudentAnswer[]
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
  answerSheet,
  currentQuestion,
  allAnswerSheets,
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
  const [totalCanvasHeight, setTotalCanvasHeight] = useState(0)

  const { drawLineWithStyle } = useDrawingUtils()

  // Canvas描画処理
  const drawCanvas = useCallback(
    (images: HTMLImageElement[]) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const container = containerRef.current
      if (!container) return

      // キャンバスサイズをコンテナに合わせる
      canvas.width = container.offsetWidth
      canvas.height = container.offsetHeight

      // 画像描画をクリア
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      console.log("=== Canvas描画処理 ===", {
        imagesLength: images.length,
        imagesSources: images.map((img) =>
          img.src?.substring(img.src.lastIndexOf("/") + 1),
        ),
      })

      // 常に複数ページ表示処理（1ページでも縦並び表示として扱う）
      let currentY = 0
      const spacing = pageSpacing || 20

      console.log("ページ描画開始", { pageCount: images.length, spacing })

      images.forEach((img, index) => {
        const displayWidth = img.naturalWidth * zoom
        const displayHeight = img.naturalHeight * zoom

        // 各ページの位置計算（中央揃え + パン位置）
        const offsetX = (canvas.width - displayWidth) / 2 - position.x
        const offsetY = currentY - position.y

        // 画像描画
        ctx.drawImage(img, offsetX, offsetY, displayWidth, displayHeight)

        // ページ間の境界線（複数ページの場合のみ）
        if (images.length > 1 && index < images.length - 1) {
          ctx.strokeStyle = "#e5e7eb"
          ctx.lineWidth = 1
          ctx.setLineDash([5, 5])
          const borderY = offsetY + displayHeight + spacing / 2
          ctx.beginPath()
          ctx.moveTo(0, borderY)
          ctx.lineTo(canvas.width, borderY)
          ctx.stroke()
          ctx.setLineDash([])
        }

        currentY += displayHeight + (images.length > 1 ? spacing : 0)
      })

      setTotalCanvasHeight(currentY - (images.length > 1 ? spacing : 0))

      // 設問枠描画
      if (currentQuestion && images.length > 0) {
        // 設問が属するページを特定（pageNumberから0ベースのインデックスに変換）
        const questionPageNumber = currentQuestion.projectPage?.pageNumber || 1
        const questionPageIndex = questionPageNumber - 1 // 1ベース→0ベースに変換

        console.log("設問枠描画:", {
          questionId: currentQuestion.id,
          questionLabel: currentQuestion.label,
          pageNumber: questionPageNumber,
          pageIndex: questionPageIndex,
          totalPages: images.length,
        })

        // 指定されたページが読み込まれた画像の範囲内かチェック
        if (questionPageIndex >= 0 && questionPageIndex < images.length) {
          const img = images[questionPageIndex]

          if (img) {
            const displayWidth = img.naturalWidth * zoom
            const displayHeight = img.naturalHeight * zoom

            // 設問位置計算（指定ページまでのオフセットを計算）
            const spacing = pageSpacing || 20
            let pageOffsetY = 0
            for (let i = 0; i < questionPageIndex; i++) {
              pageOffsetY +=
                images[i].naturalHeight * zoom +
                (images.length > 1 ? spacing : 0)
            }

            const offsetX = (canvas.width - displayWidth) / 2 - position.x
            const offsetY = pageOffsetY - position.y

            const questionX = currentQuestion.x * displayWidth + offsetX
            const questionY = currentQuestion.y * displayHeight + offsetY
            const questionWidth = currentQuestion.width * displayWidth
            const questionHeight = currentQuestion.height * displayHeight

            console.log("設問枠座標:", {
              questionX,
              questionY,
              questionWidth,
              questionHeight,
              offsetX,
              offsetY,
              pageOffsetY,
            })

            ctx.strokeStyle = "#22c55e"
            ctx.lineWidth = 2
            ctx.setLineDash([])
            ctx.strokeRect(questionX, questionY, questionWidth, questionHeight)

            // 設問ラベル
            ctx.fillStyle = "#22c55e"
            ctx.font = "14px sans-serif"
            ctx.fillText(currentQuestion.label, questionX, questionY - 5)
          }
        } else {
          console.warn("設問のページが読み込まれた画像の範囲外です:", {
            questionPageIndex,
            totalPages: images.length,
          })
        }
      }

      // 描画要素の描画
      if (images.length > 0) {
        const img = images[0]
        if (img) {
          const displayWidth = img.naturalWidth * zoom
          const displayHeight = img.naturalHeight * zoom

          const offsetX = (canvas.width - displayWidth) / 2 - position.x
          const offsetY = -position.y

          drawingElements.forEach((element) => {
            const currentX = element.x * displayWidth + offsetX
            const currentY = element.y * displayHeight + offsetY

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
                    // テキストボックス
                    const boxWidth = element.textBoxWidth * displayWidth
                    const boxHeight = element.textBoxHeight * displayHeight

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
                  const currentEndX = element.endX * displayWidth + offsetX
                  const currentEndY = element.endY * displayHeight + offsetY

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
                  const currentWidth = element.width * displayWidth
                  const currentHeight = element.height * displayHeight
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

          // 現在描画中の要素
          if (isDrawing && currentDrawing) {
            const currentX = (currentDrawing.x || 0) * displayWidth + offsetX
            const currentY = (currentDrawing.y || 0) * displayHeight + offsetY

            ctx.strokeStyle = currentDrawing.color || strokeColor
            ctx.lineWidth = currentDrawing.strokeWidth || strokeWidth
            ctx.setLineDash([])

            switch (currentDrawing.type) {
              case "line":
                if (
                  currentDrawing.endX !== undefined &&
                  currentDrawing.endY !== undefined
                ) {
                  const currentEndX =
                    currentDrawing.endX * displayWidth + offsetX
                  const currentEndY =
                    currentDrawing.endY * displayHeight + offsetY

                  // 通常の自由線
                  drawLineWithStyle(
                    ctx,
                    currentX,
                    currentY,
                    currentEndX,
                    currentEndY,
                    lineStyle as any,
                    strokeWidth,
                  )
                }
                break
              case "rectangle":
                if (
                  currentDrawing.x !== undefined &&
                  currentDrawing.y !== undefined &&
                  currentDrawing.width !== undefined &&
                  currentDrawing.height !== undefined
                ) {
                  const currentWidth = currentDrawing.width * displayWidth
                  const currentHeight = currentDrawing.height * displayHeight
                  ctx.strokeRect(
                    currentX,
                    currentY,
                    currentWidth,
                    currentHeight,
                  )
                }
                break
              case "text":
                if (
                  isCreatingTextBox &&
                  currentDrawing.x !== undefined &&
                  currentDrawing.y !== undefined &&
                  currentDrawing.textBoxWidth !== undefined &&
                  currentDrawing.textBoxHeight !== undefined
                ) {
                  // テキストボックス作成中のプレビュー表示
                  const currentWidth =
                    currentDrawing.textBoxWidth * displayWidth
                  const currentHeight =
                    currentDrawing.textBoxHeight * displayHeight
                  ctx.strokeStyle = currentDrawing.color || strokeColor
                  ctx.lineWidth = 1
                  ctx.setLineDash([5, 5])
                  ctx.strokeRect(
                    currentX,
                    currentY,
                    currentWidth,
                    currentHeight,
                  )

                  // "Text Box" プレビューテキスト
                  ctx.setLineDash([])
                  ctx.font = "14px sans-serif"
                  ctx.fillStyle = currentDrawing.color || strokeColor
                  ctx.fillText("Text Box", currentX + 5, currentY + 20)
                }
                break
            }
          }
        }
      }
    },
    [
      zoom,
      position,
      currentQuestion,
      drawingElements,
      currentDrawing,
      isDrawing,
      isCreatingTextBox,
      strokeColor,
      strokeWidth,
      lineStyle,
      isShiftPressed,
      selectedElementId,
      drawLineWithStyle,
    ],
  )

  // 複数ページ画像の読み込み処理
  useEffect(() => {
    const loadAnswerImages = async () => {
      console.log("=== Loading answer images ===", {
        answerSheetId: answerSheet?.id,
        studentId: answerSheet?.studentId,
        showMultiplePages,
        timestamp: new Date().toISOString(),
      })

      if (!answerSheet?.studentId) {
        console.warn("AnswerIndividualView: No student ID provided")
        return
      }

      let imagesToLoad: { path: string; pageNumber: number }[] = []

      console.log("画像読み込み処理開始:", {
        showMultiplePages,
        allAnswerSheetsCount: allAnswerSheets?.length || 0,
        currentStudentId: answerSheet.studentId,
      })

      if (showMultiplePages && allAnswerSheets) {
        // 複数ページ表示：同一生徒の全ページを取得
        console.log(
          "全答案シート:",
          allAnswerSheets.map((sheet) => ({
            id: sheet.id,
            studentId: sheet.studentId,
            pageNumber: sheet.pageNumber,
            imagePath: sheet.imagePath,
          })),
        )

        const studentAnswerSheets = allAnswerSheets
          .filter((sheet) => sheet.studentId === answerSheet.studentId)
          .sort((a, b) => a.pageNumber - b.pageNumber)

        console.log(
          "同一生徒の答案シート:",
          studentAnswerSheets.map((sheet) => ({
            id: sheet.id,
            pageNumber: sheet.pageNumber,
            imagePath: sheet.imagePath,
          })),
        )

        imagesToLoad = studentAnswerSheets.map((sheet) => ({
          path: sheet.imagePath,
          pageNumber: sheet.pageNumber,
        }))

        console.log("Loading multiple pages for student:", {
          studentId: answerSheet.studentId,
          pageCount: imagesToLoad.length,
          pages: imagesToLoad.map((img) => img.pageNumber),
        })
      } else {
        // 単一ページ表示：現在の答案のみ
        imagesToLoad = [
          { path: answerSheet.imagePath, pageNumber: answerSheet.pageNumber },
        ]
        console.log("Loading single page:", imagesToLoad[0])
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
          drawCanvas(successfulImages)
        } else {
          setImageLoaded(false)
        }
      }
    }

    if (answerSheet) {
      loadAnswerImages()
    }
  }, [answerSheet, allAnswerSheets, showMultiplePages, drawCanvas])

  // Canvas再描画
  useEffect(() => {
    if (imageLoaded && loadedImages.length > 0) {
      drawCanvas(loadedImages)
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
