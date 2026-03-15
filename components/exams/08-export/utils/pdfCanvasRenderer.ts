/**
 * PDF出力用Canvas描画ユーティリティ
 *
 * 一括採点個別表示のCanvas描画エンジン（useImageCanvas.ts）を流用し、
 * PDF出力に適した形式でCanvas上に描画を行う。
 */

import type { AnchorDirection } from "@/app/textbox-on-canvas-v4/types"
import { getTextPositionFromAnchor } from "@/app/textbox-on-canvas-v4/utils/canvasUtils"
import { convertTextToSvg } from "@/app/textbox-on-canvas-v4/utils/textConversionUtils"
import { mmToPixels } from "@/lib/paperSize"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

/**
 * 採点データ（PDF出力用）
 */
export interface ScoringDataForPdf {
  questionScoreId: string
  status: string // "unscored" | "correct" | "partial" | "pending" | "incorrect" | "no_answer"
  partialScore?: number | null
  cropRegion: {
    id: string
    x: number
    y: number
    width: number
    height: number
    label: string
    maxScore?: number | null // 配点
    examPage?: {
      pageNumber: number
    }
  }
}

/**
 * 採点マーク設定
 */
export interface ScoringMarkConfigForPdf {
  markPosition: string
  markSize: number
  useTransparent: boolean
  showPartialScore: boolean
  partialScorePosition: string
  partialScoreSize: number
  partialScoreOffsetX: number
  partialScoreOffsetY: number
  // 小計点用設定
  subtotalScorePosition: string
  subtotalScoreSize: number
  subtotalScoreOffsetX: number
  subtotalScoreOffsetY: number
  // 合計点用設定
  totalScorePosition: string
  totalScoreSize: number
  totalScoreOffsetX: number
  totalScoreOffsetY: number
  // ステータスごとの表示設定
  showMarkForStatus?: Record<string, boolean>
  showScoreForStatus?: Record<string, boolean>
}

/**
 * 小計点データ（PDF出力用）
 */
export interface SubtotalDataForPdf {
  regionId: string
  label: string
  score: number
  x: number
  y: number
  width: number
  height: number
  pageNumber: number
}

/**
 * 合計点データ（PDF出力用）
 */
export interface TotalScoreDataForPdf {
  regionId: string
  score: number
  maxScore: number
  x: number
  y: number
  width: number
  height: number
  pageNumber: number
}

/**
 * 描画要素（内部用、DrawingAnnotationから変換）
 */
interface DrawingElement {
  id: string
  type: "text" | "line" | "rectangle" | "ellipse"
  x: number
  y: number
  color: string
  strokeWidth: number
  width?: number
  height?: number
  endX?: number
  endY?: number
  lineStyle?: string
  text?: string
  fontSize?: number
  displayX?: number
  displayY?: number
  anchorDirection?: string
}

/**
 * DrawingAnnotationをDrawingElementに変換
 */
function convertAnnotationToDrawingElement(
  annotation: DrawingAnnotation
): DrawingElement {
  return {
    id: annotation.id,
    type: annotation.type as "text" | "line" | "rectangle" | "ellipse",
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
    displayX: annotation.displayX,
    displayY: annotation.displayY,
    anchorDirection: annotation.anchorDirection,
  }
}

/**
 * 単一の描画要素をCanvas上に描画
 *
 * useImageCanvas.ts の drawSingleElement を純粋関数として抽出
 *
 * @param ctx - Canvas 2D コンテキスト
 * @param element - 描画要素
 * @param imageWidth - 画像の幅
 * @param imageHeight - 画像の高さ
 * @param offsetX - X座標オフセット
 * @param offsetY - Y座標オフセット
 * @param pageOffset - ページオフセット（複数ページ対応用、デフォルト0）
 *                     UI側で複数ページが縦に結合されたキャンバス上で描画された場合、
 *                     アノテーションのy座標は1ページ目の高さで正規化されるため
 *                     2ページ目以降のアノテーションはy > 1.0になる。
 *                     このオフセットを引くことで正しいページ内座標に変換する。
 */
async function drawElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingElement,
  imageWidth: number,
  imageHeight: number,
  offsetX: number = 0,
  offsetY: number = 0,
  pageOffset: number = 0,
  pageSize: string = "A4"
): Promise<void> {
  // 座標計算（テキストも含めてelement.x/yを使用 - 一括採点個別表示と同じ）
  // pageOffsetを引くことで、複数ページキャンバスからの座標をページ内座標に変換
  const currentX = element.x * imageWidth + offsetX
  const currentY = (element.y - pageOffset) * imageHeight + offsetY

  // mm → canvas pixels 変換
  const strokeWidthPx = mmToPixels(
    element.strokeWidth,
    pageSize,
    imageWidth,
    imageHeight
  )
  const fontSizePx = mmToPixels(
    element.fontSize ?? 4.0,
    pageSize,
    imageWidth,
    imageHeight
  )

  ctx.strokeStyle = element.color
  ctx.fillStyle = element.color
  ctx.lineWidth = strokeWidthPx

  switch (element.type) {
    case "text":
      if (element.text) {
        const anchorDir = (element.anchorDirection ||
          "top-left") as AnchorDirection
        const textColor = element.color || "#000000"

        try {
          const svgElement = await convertTextToSvg(
            element.text,
            imageWidth,
            imageHeight,
            "left",
            "top",
            fontSizePx,
            textColor
          )

          if (svgElement) {
            let svgData = new XMLSerializer().serializeToString(svgElement)

            // MathJax defsを埋め込み
            const hasMathJaxElements =
              svgData.includes("mjx-container") || svgData.includes("<use")
            if (hasMathJaxElements) {
              const globalDefs = document.querySelector(
                "#MJX-SVG-global-cache defs"
              )
              if (globalDefs && globalDefs.innerHTML.length > 10) {
                const defsContent = globalDefs.outerHTML
                svgData = svgData.replace(/(<svg[^>]*>)/, `$1${defsContent}`)
              }
            }

            // SVG→PNG変換（Canvas taint問題を回避するためmainプロセスで実行）
            const result = await window.electronAPI.export.convertSvgToPng({
              svgString: svgData,
            })

            if (result.success && result.dataUrl) {
              const img = new Image()
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve()
                img.onerror = () =>
                  reject(new Error("Failed to load converted PNG"))
                img.src = result.dataUrl!
              })

              // 論理サイズで描画（Retinaではimg.width/heightが2倍になるため）
              const width = result.width ?? img.width
              const height = result.height ?? img.height

              const textPosition = getTextPositionFromAnchor(
                currentX,
                currentY,
                width,
                height,
                anchorDir
              )

              ctx.drawImage(img, textPosition.x, textPosition.y, width, height)
            } else {
              throw new Error(result.error || "SVG to PNG conversion failed")
            }
          } else {
            throw new Error("Failed to generate SVG")
          }
        } catch (error) {
          console.error("MathJaxテキスト描画エラー:", error)
          // フォールバック: シンプルテキスト描画
          ctx.font = `${fontSizePx}px sans-serif`
          ctx.fillStyle = textColor
          ctx.textBaseline = "top"
          const lines = element.text.split("\n")
          const lineHeight = fontSizePx * 1.4
          lines.forEach((line, index) => {
            ctx.fillText(line, currentX, currentY + index * lineHeight)
          })
        }
      }
      break

    case "line":
      if (element.endX !== undefined && element.endY !== undefined) {
        const currentEndX = element.endX * imageWidth + offsetX
        const currentEndY = (element.endY - pageOffset) * imageHeight + offsetY

        ctx.save()
        ctx.strokeStyle = element.color
        ctx.fillStyle = element.color
        ctx.lineWidth = strokeWidthPx
        ctx.setLineDash([])
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        // 線の長さと角度を計算
        const dx = currentEndX - currentX
        const dy = currentEndY - currentY
        const lineLength = Math.sqrt(dx * dx + dy * dy)
        const angle = Math.atan2(dy, dx)

        // 矢印のサイズ
        const arrowSize = strokeWidthPx * 5

        switch (element.lineStyle) {
          case "wave": {
            const waveAmplitude = strokeWidthPx * 1.5
            const waveLength = strokeWidthPx * 20
            const segments = Math.max(Math.floor(lineLength / waveLength), 1)

            ctx.beginPath()
            for (let i = 0; i <= segments; i++) {
              const t = i / segments
              const x = currentX + dx * t
              const y = currentY + dy * t
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
            const zigHeight = strokeWidthPx * 1.5
            const zigLength = strokeWidthPx * 8
            const segments = Math.max(Math.floor(lineLength / zigLength), 1)

            ctx.beginPath()
            ctx.moveTo(currentX, currentY)
            for (let i = 1; i <= segments; i++) {
              const t = i / segments
              const x = currentX + dx * t
              const y = currentY + dy * t
              const zigOffset = i % 2 === 1 ? zigHeight : -zigHeight
              const perpX = -Math.sin(angle) * zigOffset
              const perpY = Math.cos(angle) * zigOffset
              ctx.lineTo(x + perpX, y + perpY)
            }
            ctx.lineTo(currentEndX, currentEndY)
            ctx.stroke()
            break
          }

          case "double": {
            const offset = strokeWidthPx
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
            ctx.beginPath()
            ctx.moveTo(currentX, currentY)
            ctx.lineTo(currentEndX, currentEndY)
            ctx.stroke()

            ctx.beginPath()
            ctx.moveTo(currentEndX, currentEndY)
            ctx.lineTo(
              currentEndX - arrowSize * Math.cos(angle - Math.PI / 6),
              currentEndY - arrowSize * Math.sin(angle - Math.PI / 6)
            )
            ctx.lineTo(
              currentEndX - arrowSize * Math.cos(angle + Math.PI / 6),
              currentEndY - arrowSize * Math.sin(angle + Math.PI / 6)
            )
            ctx.closePath()
            ctx.fill()
            break
          }

          case "both_arrow": {
            ctx.beginPath()
            ctx.moveTo(currentX, currentY)
            ctx.lineTo(currentEndX, currentEndY)
            ctx.stroke()

            // 終点の矢印
            ctx.beginPath()
            ctx.moveTo(currentEndX, currentEndY)
            ctx.lineTo(
              currentEndX - arrowSize * Math.cos(angle - Math.PI / 6),
              currentEndY - arrowSize * Math.sin(angle - Math.PI / 6)
            )
            ctx.lineTo(
              currentEndX - arrowSize * Math.cos(angle + Math.PI / 6),
              currentEndY - arrowSize * Math.sin(angle + Math.PI / 6)
            )
            ctx.closePath()
            ctx.fill()

            // 始点の矢印
            ctx.beginPath()
            ctx.moveTo(currentX, currentY)
            ctx.lineTo(
              currentX + arrowSize * Math.cos(angle - Math.PI / 6),
              currentY + arrowSize * Math.sin(angle - Math.PI / 6)
            )
            ctx.lineTo(
              currentX + arrowSize * Math.cos(angle + Math.PI / 6),
              currentY + arrowSize * Math.sin(angle + Math.PI / 6)
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
        const rectWidth = element.width * imageWidth
        const rectHeight = element.height * imageHeight
        ctx.strokeRect(currentX, currentY, rectWidth, rectHeight)
      }
      break

    case "ellipse":
      if (element.width !== undefined && element.height !== undefined) {
        const rectWidth = element.width * imageWidth
        const rectHeight = element.height * imageHeight

        ctx.beginPath()
        ctx.ellipse(
          currentX + rectWidth / 2,
          currentY + rectHeight / 2,
          Math.abs(rectWidth) / 2,
          Math.abs(rectHeight) / 2,
          0,
          0,
          2 * Math.PI
        )
        ctx.stroke()
      }
      break
  }
}

/**
 * 採点マークの位置を計算
 */
function calculateMarkPosition(
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
  markSize: number,
  position: string
): { x: number; y: number } {
  const padding = 5

  switch (position) {
    case "top-left":
      return { x: regionX + padding, y: regionY + padding }
    case "top-center":
      return { x: regionX + (regionWidth - markSize) / 2, y: regionY + padding }
    case "top-right":
      return {
        x: regionX + regionWidth - markSize - padding,
        y: regionY + padding,
      }
    case "middle-left":
      return {
        x: regionX + padding,
        y: regionY + (regionHeight - markSize) / 2,
      }
    case "middle-center":
      return {
        x: regionX + (regionWidth - markSize) / 2,
        y: regionY + (regionHeight - markSize) / 2,
      }
    case "middle-right":
      return {
        x: regionX + regionWidth - markSize - padding,
        y: regionY + (regionHeight - markSize) / 2,
      }
    case "bottom-left":
      return {
        x: regionX + padding,
        y: regionY + regionHeight - markSize - padding,
      }
    case "bottom-center":
      return {
        x: regionX + (regionWidth - markSize) / 2,
        y: regionY + regionHeight - markSize - padding,
      }
    case "bottom-right":
      return {
        x: regionX + regionWidth - markSize - padding,
        y: regionY + regionHeight - markSize - padding,
      }
    default:
      // デフォルトは中央
      return {
        x: regionX + (regionWidth - markSize) / 2,
        y: regionY + (regionHeight - markSize) / 2,
      }
  }
}

/**
 * 部分点テキストの位置を計算
 */
function calculatePartialScorePosition(
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
  position: string,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  let baseX: number
  let baseY: number

  switch (position) {
    case "top-left":
      baseX = regionX
      baseY = regionY
      break
    case "top-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY
      break
    case "top-right":
      baseX = regionX + regionWidth
      baseY = regionY
      break
    case "middle-left":
      baseX = regionX
      baseY = regionY + regionHeight / 2
      break
    case "middle-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight / 2
      break
    case "middle-right":
      baseX = regionX + regionWidth
      baseY = regionY + regionHeight / 2
      break
    case "bottom-left":
      baseX = regionX
      baseY = regionY + regionHeight
      break
    case "bottom-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight
      break
    case "bottom-right":
      baseX = regionX + regionWidth
      baseY = regionY + regionHeight
      break
    default:
      // デフォルトは中央
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight / 2
      break
  }

  return {
    x: baseX + offsetX,
    y: baseY + offsetY,
  }
}

/**
 * 採点マーク画像を描画
 */
function drawScoringMark(
  ctx: CanvasRenderingContext2D,
  markImage: HTMLImageElement,
  region: ScoringDataForPdf["cropRegion"],
  config: ScoringMarkConfigForPdf,
  imageWidth: number,
  imageHeight: number
): void {
  const regionX = region.x * imageWidth
  const regionY = region.y * imageHeight
  const regionWidth = region.width * imageWidth
  const regionHeight = region.height * imageHeight

  const markSize = Math.min(
    config.markSize,
    regionWidth * 0.8,
    regionHeight * 0.8
  )
  const { x, y } = calculateMarkPosition(
    regionX,
    regionY,
    regionWidth,
    regionHeight,
    markSize,
    config.markPosition
  )

  ctx.drawImage(markImage, x, y, markSize, markSize)
}

/**
 * 点数テキストを描画（赤色）
 * @param score - 表示する点数
 */
function drawScoreText(
  ctx: CanvasRenderingContext2D,
  score: number,
  region: ScoringDataForPdf["cropRegion"],
  config: ScoringMarkConfigForPdf,
  imageWidth: number,
  imageHeight: number
): void {
  if (!config.showPartialScore) return

  const regionX = region.x * imageWidth
  const regionY = region.y * imageHeight
  const regionWidth = region.width * imageWidth
  const regionHeight = region.height * imageHeight

  const { x, y } = calculatePartialScorePosition(
    regionX,
    regionY,
    regionWidth,
    regionHeight,
    config.partialScorePosition,
    config.partialScoreOffsetX,
    config.partialScoreOffsetY
  )

  ctx.save()
  ctx.font = `bold ${config.partialScoreSize}px sans-serif`
  ctx.fillStyle = "#ef4444" // 点数は全て赤色
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(score), x, y)
  ctx.restore()
}

/**
 * 小計点テキストを描画（青色）
 */
function drawSubtotalScoreText(
  ctx: CanvasRenderingContext2D,
  subtotalData: SubtotalDataForPdf,
  config: ScoringMarkConfigForPdf,
  imageWidth: number,
  imageHeight: number
): void {
  const regionX = subtotalData.x * imageWidth
  const regionY = subtotalData.y * imageHeight
  const regionWidth = subtotalData.width * imageWidth
  const regionHeight = subtotalData.height * imageHeight

  const { x, y } = calculatePartialScorePosition(
    regionX,
    regionY,
    regionWidth,
    regionHeight,
    config.subtotalScorePosition,
    config.subtotalScoreOffsetX,
    config.subtotalScoreOffsetY
  )

  ctx.save()
  ctx.font = `bold ${config.subtotalScoreSize}px sans-serif`
  ctx.fillStyle = "#2563eb" // 小計点は青色
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(subtotalData.score), x, y)
  ctx.restore()
}

/**
 * 合計点テキストを描画（青色）
 */
function drawTotalScoreText(
  ctx: CanvasRenderingContext2D,
  totalScoreData: TotalScoreDataForPdf,
  config: ScoringMarkConfigForPdf,
  imageWidth: number,
  imageHeight: number
): void {
  const regionX = totalScoreData.x * imageWidth
  const regionY = totalScoreData.y * imageHeight
  const regionWidth = totalScoreData.width * imageWidth
  const regionHeight = totalScoreData.height * imageHeight

  const { x, y } = calculatePartialScorePosition(
    regionX,
    regionY,
    regionWidth,
    regionHeight,
    config.totalScorePosition,
    config.totalScoreOffsetX,
    config.totalScoreOffsetY
  )

  ctx.save()
  ctx.font = `bold ${config.totalScoreSize}px sans-serif`
  ctx.fillStyle = "#2563eb" // 合計点も青色
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(totalScoreData.score), x, y)
  ctx.restore()
}

/**
 * 答案シート1枚分をCanvas上に描画
 *
 * @param canvas - 描画先のCanvas要素
 * @param image - 答案画像
 * @param scoringDataList - 採点データのリスト（設問ごと）
 * @param annotations - 全アノテーション
 * @param config - 採点マーク設定
 * @param scoringMarkImages - 採点マーク画像のMap
 * @param subtotalDataList - 小計点データのリスト
 * @param totalScoreDataList - 合計点データのリスト
 * @param pageNumber - ページ番号（1-indexed、複数ページ対応用）
 *                     UI側で複数ページが縦に結合されたキャンバス上で描画された場合、
 *                     アノテーションのy座標は1ページ目の高さで正規化されるため
 *                     2ページ目以降のアノテーションはy > 1.0になる。
 *                     このページ番号を使ってオフセットを計算し正しい座標に変換する。
 * @returns PNG Blob
 */
export async function renderAnswerSheetToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  scoringDataList: ScoringDataForPdf[],
  annotations: DrawingAnnotation[],
  config: ScoringMarkConfigForPdf,
  scoringMarkImages: Map<string, HTMLImageElement>,
  subtotalDataList: SubtotalDataForPdf[] = [],
  totalScoreDataList: TotalScoreDataForPdf[] = [],
  pageNumber: number = 1,
  pageSize: string = "A4"
): Promise<Blob> {
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Canvas context not available")
  }

  const imageWidth = image.naturalWidth
  const imageHeight = image.naturalHeight

  // Canvasサイズを画像サイズに設定
  canvas.width = imageWidth
  canvas.height = imageHeight

  // Canvasをクリア
  ctx.clearRect(0, 0, imageWidth, imageHeight)

  // Canvas Context設定
  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1.0
  ctx.lineCap = "butt"
  ctx.lineJoin = "miter"
  ctx.miterLimit = 10
  ctx.setLineDash([])

  // 1. 答案画像を描画
  ctx.drawImage(image, 0, 0)

  // 2. 各設問に対して採点マークと部分点を描画
  for (const scoringData of scoringDataList) {
    // ステータスごとのマーク表示判定
    const shouldShowMark = config.showMarkForStatus
      ? (config.showMarkForStatus[scoringData.status] ?? true)
      : scoringData.status !== "unscored"
    if (!shouldShowMark) {
      // マークは非表示でも点数テキストは別途判定するため、マーク描画だけスキップ
    } else {
      // 採点マーク画像の取得
      const markKey =
        scoringData.status === "pending"
          ? "hold"
          : scoringData.status === "no_answer"
            ? "incorrect"
            : scoringData.status
      const markImage = scoringMarkImages.get(markKey)

      if (markImage) {
        drawScoringMark(
          ctx,
          markImage,
          scoringData.cropRegion,
          config,
          imageWidth,
          imageHeight
        )
      }
    }

    // 点数テキストの描画
    // showScoreForStatusがある場合はステータスごとに判定、ない場合は後方互換性のためpartialのみ
    const shouldShowScore = config.showScoreForStatus
      ? (config.showScoreForStatus[scoringData.status] ?? false)
      : scoringData.status === "partial"

    if (shouldShowScore) {
      // ステータスに応じた点数を決定
      let scoreToDisplay: number | null = null
      if (scoringData.status === "correct") {
        // 正解: 配点を表示
        scoreToDisplay = scoringData.cropRegion.maxScore ?? null
      } else if (scoringData.status === "partial") {
        // 部分点: 部分点を表示
        scoreToDisplay = scoringData.partialScore ?? null
      } else if (
        scoringData.status === "incorrect" ||
        scoringData.status === "no_answer"
      ) {
        // 誤答/無答: 0点を表示
        scoreToDisplay = 0
      }

      if (scoreToDisplay !== null) {
        drawScoreText(
          ctx,
          scoreToDisplay,
          scoringData.cropRegion,
          config,
          imageWidth,
          imageHeight
        )
      }
    }
  }

  // 3. 小計点を描画（青色）
  for (const subtotalData of subtotalDataList) {
    drawSubtotalScoreText(ctx, subtotalData, config, imageWidth, imageHeight)
  }

  // 4. 合計点を描画（青色）
  for (const totalScoreData of totalScoreDataList) {
    drawTotalScoreText(ctx, totalScoreData, config, imageWidth, imageHeight)
  }

  // 5. 全アノテーションを描画
  // 座標系の互換性処理:
  // - 旧データ: y座標がキャンバス全体に対する相対座標（2ページ目以降はy > 1.0）
  // - 新データ: y座標がページ内の相対座標（常に0.0 - 1.0）
  // y >= 1.0の場合は旧データとみなし、pageOffsetを引いて変換する
  // y < 1.0の場合は新データとみなし、そのまま使用する
  const basePageOffset = pageNumber - 1
  for (const annotation of annotations) {
    const element = convertAnnotationToDrawingElement(annotation)
    // y座標が1.0以上の場合のみpageOffsetを適用（旧座標系の互換性対応）
    const needsPageOffset =
      element.y >= 1.0 || (element.endY !== undefined && element.endY >= 1.0)
    const pageOffset = needsPageOffset ? basePageOffset : 0
    await drawElement(
      ctx,
      element,
      imageWidth,
      imageHeight,
      0,
      0,
      pageOffset,
      pageSize
    )
  }

  // Canvas結果をBlobとして取得
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error("Failed to create blob from canvas"))
        }
      },
      "image/png",
      1.0
    )
  })
}

/**
 * 採点マーク画像をプリロード
 *
 * fetchしてBlobからObjectURLを作成することで、Canvasのtainted問題を回避
 */
export async function preloadScoringMarkImages(
  useTransparent: boolean
): Promise<Map<string, HTMLImageElement>> {
  const prefix = useTransparent ? "tp_" : ""
  const markTypes = ["correct", "partial", "hold", "incorrect"]
  const images = new Map<string, HTMLImageElement>()

  await Promise.all(
    markTypes.map(async (type) => {
      try {
        // fetchしてBlobとして取得
        const response = await fetch(`/score-assets/${prefix}${type}.png`)
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)

        const img = new Image()
        img.src = objectUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            // ObjectURLを解放（画像は既にメモリにロード済み）
            URL.revokeObjectURL(objectUrl)
            resolve()
          }
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error(`Failed to load ${type} mark image`))
          }
        })
        images.set(type, img)
      } catch (error) {
        console.error(`Failed to fetch ${type} mark image:`, error)
        // フォールバック: 直接読み込み
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = `/score-assets/${prefix}${type}.png`
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () =>
            reject(new Error(`Failed to load ${type} mark image`))
        })
        images.set(type, img)
      }
    })
  )

  return images
}
