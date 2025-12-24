import { useDrawingUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useDrawingUtils"
import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"
import { useCallback, useEffect, useRef, useState } from "react"
import { renderTextElementV4 } from "../utils/canvasTextRendererV4"

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
  // ドラッグ中の軽量化用
  isDraggingElement?: boolean
  // 透明度制御用の全アノテーション
  allAnnotations?: any[]
  currentCropRegionId?: string | null
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
  isDraggingElement,
  allAnnotations = [],
  currentCropRegionId,
}: UseImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([])
  const isPreRenderingRef = useRef(false)

  // 採点記号画像のキャッシュ
  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement>>(new Map())

  const { drawLineWithStyle } = useDrawingUtils()

  // 採点記号画像のプリロード
  useEffect(() => {
    const markTypes = ["correct", "incorrect", "partial", "hold", "unscored"]
    const loadPromises = markTypes.map((type) => {
      return new Promise<void>((resolve) => {
        if (scoringMarkImagesRef.current.has(type)) {
          resolve()
          return
        }
        const img = new Image()
        img.onload = () => {
          scoringMarkImagesRef.current.set(type, img)
          resolve()
        }
        img.onerror = () => {
          console.warn(`Failed to load scoring mark: ${type}`)
          resolve()
        }
        // Next.jsのpublicフォルダからロード
        img.src = `/score-assets/${type}.png`
      })
    })
    Promise.all(loadPromises)
  }, [])

  // アノテーションをDrawingElement形式に変換する関数
  const convertAnnotationToDrawingElement = useCallback(
    (annotation: any): DrawingElement => {
      return {
        id: annotation.id,
        type: annotation.type as DrawingElement["type"],
        x: annotation.x,
        y: annotation.y,
        color: annotation.color,
        strokeWidth: annotation.strokeWidth,
        width: annotation.width,
        height: annotation.height,
        endX: annotation.endX,
        endY: annotation.endY,
        lineStyle: annotation.lineStyle,
        text: annotation.text,
        fontSize: annotation.fontSize,
        textBoxWidth: annotation.textBoxWidth,
        textBoxHeight: annotation.textBoxHeight,
        displayX: annotation.displayX,
        displayY: annotation.displayY,
      }
    },
    [],
  )

  // 単一要素を描画するヘルパー関数（安定化）
  const drawSingleElement = useCallback(
    async (
      ctx: CanvasRenderingContext2D,
      element: DrawingElement,
      baseImg: HTMLImageElement,
      offsetX: number,
      offsetY: number,
      isSelected: boolean,
      isDragging: boolean,
    ) => {
      // テキストボックスの場合、表示用座標があればそれを使用
      const displayX =
        element.type === "text" && element.displayX !== undefined
          ? element.displayX
          : element.x
      const displayY =
        element.type === "text" && element.displayY !== undefined
          ? element.displayY
          : element.y

      const currentX = displayX * baseImg.naturalWidth + offsetX
      const currentY = displayY * baseImg.naturalHeight + offsetY

      ctx.strokeStyle = element.color
      ctx.fillStyle = element.color
      ctx.lineWidth = element.strokeWidth

      // テキスト要素のドラッグ中は軽量描画（長方形のみ）
      if (isDragging && isSelected && element.type === "text") {
        // 軽量描画: テキスト要素は長方形で代替表示
        ctx.save()
        ctx.strokeStyle = element.color
        ctx.setLineDash([5, 5]) // 点線で軽量感を演出
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.7

        // テキストの概算サイズ
        const boundingWidth = element.text
          ? Math.max(element.text.length * (element.fontSize || 16) * 0.6, 50)
          : 50
        const boundingHeight = Math.max((element.fontSize || 16) * 1.2, 20)

        ctx.strokeRect(currentX, currentY, boundingWidth, boundingHeight)

        // 軽量テキストラベル表示
        ctx.font = "12px sans-serif"
        ctx.fillStyle = element.color
        ctx.globalAlpha = 0.8
        const shortText = element.text
          ? element.text.length > 10
            ? element.text.substring(0, 10) + "..."
            : element.text
          : "Text"
        ctx.fillText(shortText, currentX + 5, currentY + 15)

        ctx.restore()
        return
      }

      // 通常描画
      switch (element.type) {
        case "text":
          if (element.text) {
            // V4統合: 高品質テキスト描画
            try {
              await renderTextElementV4(
                ctx,
                element,
                baseImg.naturalWidth,
                baseImg.naturalHeight,
                isSelected,
              )
            } catch (error) {
              console.error("V4テキスト描画エラー:", error)
              // フォールバック: シンプルテキスト描画
              ctx.font = `${element.fontSize || 16}px sans-serif`
              ctx.fillStyle = element.color
              const lines = element.text.split("\n")
              const lineHeight = (element.fontSize || 16) * 1.4
              lines.forEach((line, index) => {
                ctx.fillText(line, currentX, currentY + index * lineHeight)
              })
            }
          }
          break
        case "line":
          if (element.endX !== undefined && element.endY !== undefined) {
            const currentEndX = element.endX * baseImg.naturalWidth + offsetX
            const currentEndY = element.endY * baseImg.naturalHeight + offsetY

            ctx.save()
            ctx.strokeStyle = element.color
            // drawLineWithStyleを直接実装（依存関係を回避）
            ctx.lineWidth = element.strokeWidth
            ctx.setLineDash([]) // デフォルトは実線
            
            // LineStyle に応じた描画（簡略版）
            switch (element.lineStyle) {
              case "wave":
              case "zigzag":
                // 複雑な描画は省略し、点線で代替
                ctx.setLineDash([5, 5])
                break
              case "double":
                // 二重線は太さを調整
                ctx.lineWidth = element.strokeWidth * 1.5
                break
              default:
                // solid, arrow, both_arrow は通常の直線
                break
            }
            
            ctx.beginPath()
            ctx.moveTo(currentX, currentY)
            ctx.lineTo(currentEndX, currentEndY)
            ctx.stroke()
            ctx.restore()
          }
          break
        case "rectangle":
          if (element.width !== undefined && element.height !== undefined) {
            const rectWidth = element.width * baseImg.naturalWidth
            const rectHeight = element.height * baseImg.naturalHeight

            ctx.strokeRect(currentX, currentY, rectWidth, rectHeight)
          }
          break
        case "ellipse":
          if (element.width !== undefined && element.height !== undefined) {
            const rectWidth = element.width * baseImg.naturalWidth
            const rectHeight = element.height * baseImg.naturalHeight

            ctx.beginPath()
            ctx.ellipse(
              currentX + rectWidth / 2,
              currentY + rectHeight / 2,
              Math.abs(rectWidth) / 2,
              Math.abs(rectHeight) / 2,
              0,
              0,
              2 * Math.PI,
            )
            ctx.stroke()
          }
          break
      }
    },
    [], // 依存関係を空にして安定化
  )

  // Canvas描画処理（CSS scale + scroll 方式）
  const drawCanvas = useCallback(
    async (images: HTMLImageElement[]) => {
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

            // 採点記号の描画（中央配置）
            if (currentScoringData && currentScoringData.status !== "unscored") {
              // ステータスに対応する画像キーを取得
              const markKey = currentScoringData.status === "pending" ? "hold"
                : currentScoringData.status === "no_answer" ? "incorrect"
                : currentScoringData.status
              const markImage = scoringMarkImagesRef.current.get(markKey)

              if (markImage) {
                // 採点記号のサイズ（設問領域の高さの50%、最大100px）
                const markSize = Math.min(questionHeight * 0.5, 100)

                // 中央配置
                const markX = questionX + (questionWidth - markSize) / 2
                const markY = questionY + (questionHeight - markSize) / 2

                ctx.drawImage(markImage, markX, markY, markSize, markSize)
              }
            }
          }
        } else {
          // Question page is outside loaded image range
        }
      }

      // 描画要素の描画（CSS scale方式）
      if (images.length > 0) {
        const baseImg = images[0]
        if (baseImg) {
          // 画像の中央配置に合わせてオフセット調整
          const offsetX = (canvasWidth - baseImg.naturalWidth) / 2
          const offsetY = 0

          // パフォーマンス最適化: ドラッグ中は他設問のアノテーションを非表示
          const isAnyElementDragging = isDraggingElement && selectedElementIds.length > 0
          
          if (!isAnyElementDragging) {
            // まず現在の設問以外のアノテーション（全設問）を50%透明度で描画
            for (const annotation of allAnnotations) {
              // 現在の設問のアノテーションはスキップ（後で通常描画）
              if (
                annotation.questionScore?.cropRegionId === currentCropRegionId
              ) {
                continue
              }

              // アノテーションをDrawingElement形式に変換
              const element = convertAnnotationToDrawingElement(annotation)

              // 透明度を50%に設定（読み取り専用表示）
              ctx.globalAlpha = 0.5

              // 読み取り専用のスタイルで描画
              await drawSingleElement(
                ctx,
                element,
                baseImg,
                offsetX,
                offsetY,
                false, // 選択されていない
                false, // ドラッグ中でない
              )

              // 透明度を元に戻す
              ctx.globalAlpha = 1.0
            }
          }

          // 次に現在の設問の描画要素を描画（ドラッグ中の軽量化対応）
          for (const element of drawingElements) {
            const isSelected = selectedElementIds.includes(element.id)
            const isDragging = (isDraggingElement || false) && isSelected

            // ドラッグ中かつ選択されていない要素は軽量描画
            if (isAnyElementDragging && !isSelected) {
              // 軽量描画: 選択されていない要素は薄く表示
              ctx.globalAlpha = 0.3
              await drawSingleElement(
                ctx,
                element,
                baseImg,
                offsetX,
                offsetY,
                false,
                false,
              )
              ctx.globalAlpha = 1.0
            } else {
              // 通常描画（選択中の要素 or ドラッグしていない時）
              await drawSingleElement(
                ctx,
                element,
                baseImg,
                offsetX,
                offsetY,
                isSelected,
                isDragging,
              )
            }
          }

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
                    // V4統合: テキストアンカーの場合は単一のハンドルのみ表示
                    if (selectedElement.text) {
                      const textX =
                        selectedElement.x * baseImg.naturalWidth + offsetX
                      const textY =
                        selectedElement.y * baseImg.naturalHeight + offsetY

                      // アンカー位置に1つのハンドルを描画
                      ctx.fillRect(
                        textX - halfHandle,
                        textY - halfHandle,
                        handleSize,
                        handleSize,
                      )
                      ctx.strokeRect(
                        textX - halfHandle,
                        textY - halfHandle,
                        handleSize,
                        handleSize,
                      )
                    }
                    break
                }
              }
            })
            ctx.restore()
          }

          // 現在描画中の要素（リアルタイムプレビュー）
          if (isDrawing && currentDrawing) {
            // テキストボックスの場合、表示用座標があればそれを使用
            const drawingDisplayX =
              currentDrawing.type === "text" &&
              currentDrawing.displayX !== undefined
                ? currentDrawing.displayX
                : currentDrawing.x
            const drawingDisplayY =
              currentDrawing.type === "text" &&
              currentDrawing.displayY !== undefined
                ? currentDrawing.displayY
                : currentDrawing.y

            const currentX =
              (drawingDisplayX || 0) * baseImg.naturalWidth + offsetX
            const currentY =
              (drawingDisplayY || 0) * baseImg.naturalHeight + offsetY

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
                // V4統合: テキストはクリック配置のため、作成中プレビューは不要
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
      currentScoringData,
      zoom,
      drawingElements,
      selectedElementIds,
      isDrawing,
      currentDrawing,
      isDrawingSelection,
      selectionRectangle,
      strokeColor,
      strokeWidth,
      isDraggingElement,
      allAnnotations,
      currentCropRegionId,
      convertAnnotationToDrawingElement,
      drawSingleElement,
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
        }

        // drawCanvasは別のuseEffectで処理されるため、ここでは呼ばない
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
          }

          // drawCanvasは別のuseEffectで処理されるため、ここでは呼ばない
        } else {
          setImageLoaded(false)
        }
      }
    }

    if (currentScoringData) {
      loadAnswerImages()
    }
  }, [currentScoringData, pageImages, showMultiplePages])

  // Canvas再描画（全ての要素を統合）
  useEffect(() => {
    const redraw = async () => {
      if (imageLoaded && loadedImages.length > 0) {
        await drawCanvas(loadedImages)
      }
    }
    redraw()
  }, [imageLoaded, loadedImages, drawCanvas])

  // コンテナリサイズの監視とCanvas再描画
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(async () => {
      if (imageLoaded && loadedImages.length > 0) {
        await drawCanvas(loadedImages)
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
