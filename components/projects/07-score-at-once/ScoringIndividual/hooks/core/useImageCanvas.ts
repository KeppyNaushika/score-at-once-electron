import { getTextPositionFromAnchor } from "@/app/textbox-on-canvas-v4/utils/canvasUtils"
import { useDrawingStyleUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/utils/useDrawingStyle"
import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  clearSvgCache,
  renderTextElementV4,
} from "../../utils/canvasTextRendererV4"

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
  // ホバー中の要素ID（ハンドル表示用）
  hoveredElementId?: string | null
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
  hoveredElementId,
}: UseImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null) // ハンドル専用オーバーレイ
  const textCanvasRef = useRef<HTMLCanvasElement>(null) // テキスト専用レイヤー
  const imageRef = useRef<HTMLImageElement>(null)
  // テキスト要素のレンダリング結果をキャッシュ（ヒットテスト用）
  const textBoundsCacheRef = useRef<
    Map<string, { x: number; y: number; width: number; height: number }>
  >(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([])
  const isPreRenderingRef = useRef(false)

  // ドラッグ状態を同期的に追跡するref（React状態更新の遅延を回避）
  const isDraggingRef = useRef(isDraggingElement ?? false)
  const prevIsDraggingForRedrawRef = useRef(isDraggingElement ?? false)
  useLayoutEffect(() => {
    isDraggingRef.current = isDraggingElement ?? false
  }, [isDraggingElement])

  // 設問変更時にSVGキャッシュをクリア（IDベースキャッシュの整合性維持）
  useEffect(() => {
    clearSvgCache()
    textBoundsCacheRef.current.clear()
  }, [currentCropRegionId])

  // ホバー要素ID（オーバーレイキャンバスで使用）

  // 採点記号画像のキャッシュ
  const scoringMarkImagesRef = useRef<Map<string, HTMLImageElement>>(new Map())

  const { drawLineWithStyle } = useDrawingStyleUtils()

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
        anchorDirection: annotation.anchorDirection, // アンカー方向
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
      showAnchor: boolean = true, // 他設問のテキストではアンカー非表示
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

        // アンカー方向に基づいてテキスト位置を計算
        const anchorDir = element.anchorDirection || "top-left"
        const textPos = getTextPositionFromAnchor(
          currentX,
          currentY,
          boundingWidth,
          boundingHeight,
          anchorDir,
        )

        ctx.strokeRect(textPos.x, textPos.y, boundingWidth, boundingHeight)

        // 軽量テキストラベル表示
        ctx.font = "12px sans-serif"
        ctx.fillStyle = element.color
        ctx.globalAlpha = 0.8
        const shortText = element.text
          ? element.text.length > 10
            ? element.text.substring(0, 10) + "..."
            : element.text
          : "Text"
        ctx.fillText(shortText, textPos.x + 5, textPos.y + 15)

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
                showAnchor, // 他設問のテキストではアンカー非表示
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
            ctx.fillStyle = element.color
            ctx.lineWidth = element.strokeWidth
            ctx.setLineDash([]) // デフォルトは実線
            ctx.lineCap = "round"
            ctx.lineJoin = "round"

            // 線の長さと角度を計算
            const dx = currentEndX - currentX
            const dy = currentEndY - currentY
            const lineLength = Math.sqrt(dx * dx + dy * dy)
            const angle = Math.atan2(dy, dx)

            // 矢印のサイズ（線の太さに比例して大きく）
            const arrowSize = Math.max(element.strokeWidth * 5, 12)

            // LineStyle に応じた描画
            switch (element.lineStyle) {
              case "wave": {
                // 波線の描画
                const waveAmplitude = element.strokeWidth * 2
                const waveLength = element.strokeWidth * 4
                const segments = Math.max(
                  Math.floor(lineLength / waveLength),
                  1,
                )

                ctx.beginPath()
                ctx.moveTo(currentX, currentY)

                for (let i = 0; i <= segments; i++) {
                  const t = i / segments
                  const x = currentX + dx * t
                  const y = currentY + dy * t
                  // 波のオフセット（線に垂直方向）
                  const waveOffset =
                    Math.sin(t * segments * Math.PI * 2) * waveAmplitude
                  const perpX = -Math.sin(angle) * waveOffset
                  const perpY = Math.cos(angle) * waveOffset

                  if (i === 0) {
                    ctx.moveTo(x + perpX, y + perpY)
                  } else {
                    ctx.lineTo(x + perpX, y + perpY)
                  }
                }
                ctx.stroke()
                break
              }
              case "zigzag": {
                // 折れ線（ジグザグ）の描画
                const zigHeight = element.strokeWidth * 2
                const zigLength = element.strokeWidth * 3
                const segments = Math.max(Math.floor(lineLength / zigLength), 1)

                ctx.beginPath()
                ctx.moveTo(currentX, currentY)

                for (let i = 1; i <= segments; i++) {
                  const t = i / segments
                  const x = currentX + dx * t
                  const y = currentY + dy * t
                  // ジグザグのオフセット（交互に上下）
                  const zigOffset = i % 2 === 1 ? zigHeight : -zigHeight
                  const perpX = -Math.sin(angle) * zigOffset
                  const perpY = Math.cos(angle) * zigOffset
                  ctx.lineTo(x + perpX, y + perpY)
                }
                // 終点に戻る
                ctx.lineTo(currentEndX, currentEndY)
                ctx.stroke()
                break
              }
              case "double": {
                // 二重線の描画
                const offset = element.strokeWidth
                const perpX = -Math.sin(angle) * offset
                const perpY = Math.cos(angle) * offset

                ctx.beginPath()
                ctx.moveTo(currentX + perpX, currentY + perpY)
                ctx.lineTo(currentEndX + perpX, currentEndY + perpY)
                ctx.stroke()

                ctx.beginPath()
                ctx.moveTo(currentX - perpX, currentY - perpY)
                ctx.lineTo(currentEndX - perpX, currentEndY - perpY)
                ctx.stroke()
                break
              }
              case "arrow": {
                // 矢印（終点のみ）
                ctx.beginPath()
                ctx.moveTo(currentX, currentY)
                ctx.lineTo(currentEndX, currentEndY)
                ctx.stroke()

                // 矢印の頭を描画
                ctx.beginPath()
                ctx.moveTo(currentEndX, currentEndY)
                ctx.lineTo(
                  currentEndX - arrowSize * Math.cos(angle - Math.PI / 6),
                  currentEndY - arrowSize * Math.sin(angle - Math.PI / 6),
                )
                ctx.lineTo(
                  currentEndX - arrowSize * Math.cos(angle + Math.PI / 6),
                  currentEndY - arrowSize * Math.sin(angle + Math.PI / 6),
                )
                ctx.closePath()
                ctx.fill()
                break
              }
              case "both_arrow": {
                // 両矢印
                ctx.beginPath()
                ctx.moveTo(currentX, currentY)
                ctx.lineTo(currentEndX, currentEndY)
                ctx.stroke()

                // 終点の矢印
                ctx.beginPath()
                ctx.moveTo(currentEndX, currentEndY)
                ctx.lineTo(
                  currentEndX - arrowSize * Math.cos(angle - Math.PI / 6),
                  currentEndY - arrowSize * Math.sin(angle - Math.PI / 6),
                )
                ctx.lineTo(
                  currentEndX - arrowSize * Math.cos(angle + Math.PI / 6),
                  currentEndY - arrowSize * Math.sin(angle + Math.PI / 6),
                )
                ctx.closePath()
                ctx.fill()

                // 始点の矢印（反対方向）
                ctx.beginPath()
                ctx.moveTo(currentX, currentY)
                ctx.lineTo(
                  currentX + arrowSize * Math.cos(angle - Math.PI / 6),
                  currentY + arrowSize * Math.sin(angle - Math.PI / 6),
                )
                ctx.lineTo(
                  currentX + arrowSize * Math.cos(angle + Math.PI / 6),
                  currentY + arrowSize * Math.sin(angle + Math.PI / 6),
                )
                ctx.closePath()
                ctx.fill()
                break
              }
              default:
                // solid - 通常の直線
                ctx.beginPath()
                ctx.moveTo(currentX, currentY)
                ctx.lineTo(currentEndX, currentEndY)
                ctx.stroke()
                break
            }

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
            if (
              currentScoringData &&
              currentScoringData.status !== "unscored"
            ) {
              // ステータスに対応する画像キーを取得
              const markKey =
                currentScoringData.status === "pending"
                  ? "hold"
                  : currentScoringData.status === "no_answer"
                    ? "incorrect"
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

          // ドラッグ中判定（新規描画・リサイズ・選択範囲矩形を含む）
          const isAnyElementDragging =
            isDraggingRef.current && selectedElementIds.length > 0
          const isDragging =
            isDrawing || isAnyElementDragging || isDrawingSelection

          // ======== 他設問のアノテーション（テキスト以外） ========
          // ドラッグ中でない場合のみ描画（50%透明度）
          // テキストはテキストキャンバスで一元管理するためスキップ
          if (!isDragging) {
            for (const annotation of allAnnotations) {
              if (
                annotation.questionScore?.cropRegionId === currentCropRegionId
              ) {
                continue // 現在設問は後で描画
              }
              if (annotation.type === "text") {
                continue // テキストはテキストキャンバスで描画
              }
              const element = convertAnnotationToDrawingElement(annotation)
              ctx.globalAlpha = 0.5
              await drawSingleElement(
                ctx,
                element,
                baseImg,
                offsetX,
                offsetY,
                false,
                false,
                false,
              )
              ctx.globalAlpha = 1.0
            }
          }

          // ======== 現在設問の描画要素（テキスト以外） ========
          for (const element of drawingElements) {
            // テキスト要素は専用レイヤーで描画するためスキップ
            if (element.type === "text") {
              continue
            }

            const isSelected = selectedElementIds.includes(element.id)

            // 透明度: ドラッグ中は選択外30%、それ以外100%
            ctx.globalAlpha = isDragging && !isSelected ? 0.3 : 1.0
            await drawSingleElement(
              ctx,
              element,
              baseImg,
              offsetX,
              offsetY,
              isSelected,
              false,
            )
            ctx.globalAlpha = 1.0
          }

          // ハンドル描画はオーバーレイキャンバスに移動

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
      isDrawing, // 新規描画中はテキスト要素をスキップするため必要
      isDrawingSelection,
      selectionRectangle,
      allAnnotations,
      currentCropRegionId,
      // isDraggingElement は依存配列に含めない（テキストドラッグ中はオーバーレイで表示）
      convertAnnotationToDrawingElement,
      drawSingleElement,
    ],
  )

  // オーバーレイキャンバス描画（ハンドル専用）
  const drawOverlay = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current
    const mainCanvas = canvasRef.current
    if (!overlayCanvas || !mainCanvas) return
    if (loadedImages.length === 0) return

    const ctx = overlayCanvas.getContext("2d")
    if (!ctx) return

    const baseImg = loadedImages[0]
    const canvasWidth = baseImg.naturalWidth
    const totalHeight = loadedImages.reduce(
      (total, img, index) =>
        total +
        img.naturalHeight +
        (index < loadedImages.length - 1 ? pageSpacing || 20 : 0),
      0,
    )

    // オーバーレイキャンバスをメインキャンバスと同じサイズに設定
    overlayCanvas.width = canvasWidth
    overlayCanvas.height = totalHeight

    // クリア
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    // 画像の中央配置に合わせてオフセット調整
    const offsetX = (canvasWidth - baseImg.naturalWidth) / 2
    const offsetY = 0

    // ハンドル描画ヘルパー関数
    const drawElementHandles = (
      element: DrawingElement,
      handleSize: number,
      halfHandle: number,
      fillColor: string,
      opacity: number = 1.0,
    ) => {
      ctx.save()
      ctx.globalAlpha = opacity
      ctx.fillStyle = fillColor
      ctx.strokeStyle = "#ffffff" // 白い縁取り
      ctx.lineWidth = 2

      switch (element.type) {
        case "line":
          if (element.endX !== undefined && element.endY !== undefined) {
            ctx.fillStyle = opacity < 1.0 ? fillColor : "#22c55e" // ホバー時は単色、選択時は緑
            const startX = element.x * baseImg.naturalWidth + offsetX
            const startY = element.y * baseImg.naturalHeight + offsetY
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

            ctx.fillStyle = opacity < 1.0 ? fillColor : "#ef4444" // ホバー時は単色、選択時は赤
            const endX = element.endX * baseImg.naturalWidth + offsetX
            const endY = element.endY * baseImg.naturalHeight + offsetY
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
        case "ellipse":
          if (element.width !== undefined && element.height !== undefined) {
            const x = element.x * baseImg.naturalWidth + offsetX
            const y = element.y * baseImg.naturalHeight + offsetY
            const w = element.width * baseImg.naturalWidth
            const h = element.height * baseImg.naturalHeight
            const corners = [
              { x, y },
              { x: x + w, y },
              { x, y: y + h },
              { x: x + w, y: y + h },
            ]
            corners.forEach((c) => {
              ctx.fillRect(
                c.x - halfHandle,
                c.y - halfHandle,
                handleSize,
                handleSize,
              )
              ctx.strokeRect(
                c.x - halfHandle,
                c.y - halfHandle,
                handleSize,
                handleSize,
              )
            })
          }
          break
        case "text":
          if (element.text) {
            const textX = element.x * baseImg.naturalWidth + offsetX
            const textY = element.y * baseImg.naturalHeight + offsetY
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
      ctx.restore()
    }

    const baseHandleSize = 8
    const handleSize = baseHandleSize / zoom
    const halfHandle = handleSize / 2

    // ホバー中要素のハンドルを描画（選択されていない場合のみ、50%透明度）
    if (hoveredElementId && !selectedElementIds.includes(hoveredElementId)) {
      const hoveredElement = drawingElements.find(
        (el) => el.id === hoveredElementId,
      )
      if (hoveredElement) {
        drawElementHandles(
          hoveredElement,
          handleSize,
          halfHandle,
          "#3b82f6",
          0.5,
        )
      }
    }

    // 選択中要素のハンドル（編集点）を描画
    if (selectedElementIds.length > 0) {
      selectedElementIds.forEach((id) => {
        const element = drawingElements.find((el) => el.id === id)
        if (!element) return
        drawElementHandles(element, handleSize, halfHandle, "#3b82f6", 1.0)
      })
    }

    // テキスト要素のドラッグ中: 簡易表示（オーバーレイに描画）
    if (isDraggingElement && selectedElementIds.length > 0) {
      selectedElementIds.forEach((id) => {
        const element = drawingElements.find((el) => el.id === id)
        if (!element || element.type !== "text") return

        // 簡易表示: 点線矩形 + 短縮テキスト
        ctx.save()
        ctx.strokeStyle = element.color
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.7

        // アンカー位置（element.x, element.yはアンカー座標）
        const anchorX = element.x * baseImg.naturalWidth + offsetX
        const anchorY = element.y * baseImg.naturalHeight + offsetY

        // テキストの概算サイズ
        const boundingWidth = element.text
          ? Math.max(element.text.length * (element.fontSize || 16) * 0.6, 50)
          : 50
        const boundingHeight = Math.max((element.fontSize || 16) * 1.2, 20)

        // アンカー方向に基づいてテキスト位置を計算
        const anchorDir = element.anchorDirection || "top-left"
        const textPos = getTextPositionFromAnchor(
          anchorX,
          anchorY,
          boundingWidth,
          boundingHeight,
          anchorDir,
        )

        ctx.strokeRect(textPos.x, textPos.y, boundingWidth, boundingHeight)

        // 短縮テキスト表示
        ctx.font = "12px sans-serif"
        ctx.fillStyle = element.color
        ctx.globalAlpha = 0.8
        ctx.setLineDash([])
        const shortText = element.text
          ? element.text.length > 10
            ? element.text.substring(0, 10) + "..."
            : element.text
          : "Text"
        ctx.fillText(shortText, textPos.x + 5, textPos.y + 15)

        ctx.restore()
      })
    }
  }, [
    loadedImages,
    pageSpacing,
    zoom,
    hoveredElementId,
    selectedElementIds,
    drawingElements,
    isDraggingElement,
  ])

  // テキスト専用キャンバス描画
  const drawTextCanvas = useCallback(async () => {
    const textCanvas = textCanvasRef.current
    if (!textCanvas) return
    if (loadedImages.length === 0) return

    const ctx = textCanvas.getContext("2d")
    if (!ctx) return

    const baseImg = loadedImages[0]
    const canvasWidth = baseImg.naturalWidth
    const canvasHeight = baseImg.naturalHeight
    const totalHeight = loadedImages.reduce(
      (total, img, index) =>
        total +
        img.naturalHeight +
        (index < loadedImages.length - 1 ? pageSpacing || 20 : 0),
      0,
    )

    // テキストキャンバスをメインキャンバスと同じサイズに設定
    textCanvas.width = canvasWidth
    textCanvas.height = totalHeight

    // クリア
    ctx.clearRect(0, 0, textCanvas.width, textCanvas.height)

    // キャッシュをクリア
    textBoundsCacheRef.current.clear()

    // drawingElementsをIDで検索するためのMap
    const drawingElementsMap = new Map(
      drawingElements.map((el) => [el.id, el]),
    )

    // ======== 全テキストをallAnnotationsから描画（並列処理） ========
    // cropRegionIdで現在設問かどうかを判定し、透明度とアンカー表示を切り替え
    const textAnnotations = allAnnotations.filter(
      (a) => a.type === "text" && a.text,
    )
    const drawnIds = new Set(textAnnotations.map((a) => a.id))

    // 並列でSVG生成、結果を収集
    const annotationResults = await Promise.all(
      textAnnotations.map(async (annotation) => {
        const isCurrentQuestion =
          annotation.questionScore?.cropRegionId === currentCropRegionId

        // 現在設問の場合、drawingElementsから最新の位置を取得
        // （ドラッグ後のローカル更新がDBに反映される前でも正しく表示するため）
        let element: DrawingElement
        if (isCurrentQuestion) {
          const localElement = drawingElementsMap.get(annotation.id)
          if (localElement) {
            // drawingElementsに存在する場合は最新の位置を使用
            element = localElement
          } else {
            // 存在しない場合はannotationから変換
            element = convertAnnotationToDrawingElement(annotation)
          }
        } else {
          // 他設問はannotationから変換
          element = convertAnnotationToDrawingElement(annotation)
        }

        const isSelected =
          isCurrentQuestion && selectedElementIds.includes(element.id)

        try {
          const result = await renderTextElementV4(
            ctx,
            element,
            canvasWidth,
            canvasHeight,
            isSelected,
            isCurrentQuestion, // 現在設問のみアンカー表示
            isCurrentQuestion ? 1.0 : 0.3, // 現在設問100%、他設問30%
          )
          return { element, result, isCurrentQuestion }
        } catch (error) {
          return null
        }
      }),
    )

    // 現在設問のテキストをキャッシュ（ヒットテスト用）
    for (const item of annotationResults) {
      if (item && item.isCurrentQuestion && item.result.success) {
        textBoundsCacheRef.current.set(item.element.id, {
          x: item.result.textBounds.x / canvasWidth,
          y: item.result.textBounds.y / canvasHeight,
          width: item.result.textBounds.width / canvasWidth,
          height: item.result.textBounds.height / canvasHeight,
        })
      }
    }

    // ======== drawingElementsにあるがallAnnotationsにない要素（新規作成直後） ========
    const newTextElements = drawingElements.filter(
      (el) => el.type === "text" && el.text && !drawnIds.has(el.id),
    )

    if (newTextElements.length > 0) {
      const newResults = await Promise.all(
        newTextElements.map(async (element) => {
          const isSelected = selectedElementIds.includes(element.id)
          try {
            const result = await renderTextElementV4(
              ctx,
              element,
              canvasWidth,
              canvasHeight,
              isSelected,
              true, // 現在設問なのでアンカー表示
              1.0, // 100%
            )
            return { element, result }
          } catch (error) {
            return null
          }
        }),
      )

      // キャッシュ更新
      for (const item of newResults) {
        if (item && item.result.success) {
          textBoundsCacheRef.current.set(item.element.id, {
            x: item.result.textBounds.x / canvasWidth,
            y: item.result.textBounds.y / canvasHeight,
            width: item.result.textBounds.width / canvasWidth,
            height: item.result.textBounds.height / canvasHeight,
          })
        }
      }
    }
  }, [
    loadedImages,
    pageSpacing,
    drawingElements,
    selectedElementIds,
    allAnnotations,
    currentCropRegionId,
    convertAnnotationToDrawingElement,
  ])

  // オーバーレイキャンバスの描画（ホバー/選択状態変更時のみ）
  useEffect(() => {
    if (!imageLoaded || loadedImages.length === 0) return
    drawOverlay()
  }, [imageLoaded, loadedImages, drawOverlay])

  // テキストキャンバスの描画制御
  const prevTextDraggingRef = useRef(false)
  const wasTextDraggedRef = useRef(false)

  // テキストキャンバスの排他制御（非同期描画の競合防止）
  const isDrawingTextCanvasRef = useRef(false)
  const needsTextRedrawRef = useRef(false)

  // 排他制御付きテキストキャンバス描画
  const executeTextCanvasDraw = useCallback(async () => {
    // 描画中の場合は、再描画フラグを立てて終了
    if (isDrawingTextCanvasRef.current) {
      needsTextRedrawRef.current = true
      return
    }

    // 描画開始
    isDrawingTextCanvasRef.current = true
    needsTextRedrawRef.current = false

    try {
      await drawTextCanvas()
    } finally {
      // 描画完了
      isDrawingTextCanvasRef.current = false

      // 再描画が必要な場合は実行
      if (needsTextRedrawRef.current) {
        needsTextRedrawRef.current = false
        executeTextCanvasDraw()
      }
    }
  }, [drawTextCanvas])

  // テキストドラッグ終了時の再描画
  useEffect(() => {
    if (!imageLoaded || loadedImages.length === 0) return

    // 現在テキスト要素がドラッグ中かどうか
    const isTextBeingDragged =
      (isDraggingElement ?? false) &&
      selectedElementIds.some((id) =>
        drawingElements.find((el) => el.id === id && el.type === "text"),
      )

    // テキストドラッグ開始を検出
    if (isTextBeingDragged && !prevTextDraggingRef.current) {
      wasTextDraggedRef.current = true
    }

    // ドラッグ終了時、テキストがドラッグされていた場合のみ再描画
    if (!isDraggingElement && wasTextDraggedRef.current) {
      executeTextCanvasDraw()
      wasTextDraggedRef.current = false
    }

    prevTextDraggingRef.current = isTextBeingDragged
  }, [
    imageLoaded,
    loadedImages,
    executeTextCanvasDraw,
    isDraggingElement,
    selectedElementIds,
    drawingElements,
  ])

  // テキストキャンバスの描画
  // drawingElements、allAnnotations、currentCropRegionIdの変更を直接追跡して再描画
  useEffect(() => {
    if (!imageLoaded || loadedImages.length === 0) return
    if (isDraggingElement) return
    executeTextCanvasDraw()
  }, [
    imageLoaded,
    loadedImages,
    isDraggingElement,
    executeTextCanvasDraw,
    // データ変更を直接追跡（Reactのバッチ更新による遅延を回避）
    drawingElements,
    allAnnotations,
    currentCropRegionId,
  ])

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

  // 描画の排他制御（非同期描画の競合防止）
  const isDrawingCanvasRef = useRef(false)
  const needsRedrawRef = useRef(false)
  const latestDrawParamsRef = useRef<{
    imageLoaded: boolean
    loadedImages: HTMLImageElement[]
    drawCanvas: (images: HTMLImageElement[]) => Promise<void>
  } | null>(null)

  // Canvas再描画（全ての要素を統合）- 排他制御付き
  useEffect(() => {
    // 最新のパラメータを保存
    latestDrawParamsRef.current = { imageLoaded, loadedImages, drawCanvas }

    const executeRedraw = async () => {
      const params = latestDrawParamsRef.current
      if (!params || !params.imageLoaded || params.loadedImages.length === 0)
        return

      // 描画中の場合は、再描画フラグを立てて終了
      if (isDrawingCanvasRef.current) {
        needsRedrawRef.current = true
        return
      }

      // 描画開始
      isDrawingCanvasRef.current = true
      needsRedrawRef.current = false

      try {
        await params.drawCanvas(params.loadedImages)
      } finally {
        // 描画完了
        isDrawingCanvasRef.current = false

        // 再描画が必要な場合は実行
        if (needsRedrawRef.current) {
          needsRedrawRef.current = false
          executeRedraw()
        }
      }
    }
    executeRedraw()
  }, [imageLoaded, loadedImages, drawCanvas])

  // ドラッグ終了時にメインキャンバスを再描画（透明度を100%に戻す）
  useEffect(() => {
    const wasDragging = prevIsDraggingForRedrawRef.current
    const isDragging = isDraggingElement ?? false
    prevIsDraggingForRedrawRef.current = isDragging

    // ドラッグ状態がtrueからfalseに変わった時のみ再描画
    if (wasDragging && !isDragging && imageLoaded && loadedImages.length > 0) {
      drawCanvas(loadedImages)
    }
  }, [isDraggingElement, imageLoaded, loadedImages, drawCanvas])

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
    overlayCanvasRef, // ハンドル描画用オーバーレイ
    textCanvasRef, // テキスト専用レイヤー
    imageRef,
    containerRef,
    imageLoaded,
    loadedImages,
    textBoundsCache: textBoundsCacheRef.current, // テキスト要素の境界キャッシュ（ヒットテスト用）
  }
}
