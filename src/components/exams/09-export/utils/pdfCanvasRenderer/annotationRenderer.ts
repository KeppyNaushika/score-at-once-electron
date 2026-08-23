/**
 * アノテーション（DrawingAnnotation）のCanvas描画
 *
 * useImageCanvas.ts の drawSingleElement を純粋関数として抽出したもの。
 */

import { mmToPixels } from "@/lib/paperSize"
import { getTextPositionFromAnchor } from "@/lib/textbox-canvas/canvasUtils"
import { convertTextToSvg } from "@/lib/textbox-canvas/textConversionUtils"
import { convertSvgToPng } from "@/queries/export"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

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
export async function drawElement(
  ctx: CanvasRenderingContext2D,
  element: DrawingAnnotation,
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
    element.fontSize,
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
        const anchorDir = element.anchorDirection
        const textColor = element.color

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
            const result = await convertSvgToPng({ svgString: svgData })

            const img = new Image()
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve()
              img.onerror = () =>
                reject(new Error("Failed to load converted PNG"))
              img.src = result.dataUrl
            })

            // 論理サイズで描画（Retinaではimg.width/heightが2倍になるため）
            const textPosition = getTextPositionFromAnchor(
              currentX,
              currentY,
              result.width,
              result.height,
              anchorDir
            )

            ctx.drawImage(
              img,
              textPosition.x,
              textPosition.y,
              result.width,
              result.height
            )
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
      {
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
            // cos波（中央揃え）: 線分の中央が波の頂点
            const waveAmplitude = strokeWidthPx * 1.5
            const wavelength = strokeWidthPx * 10 * 2

            const perpX = -Math.sin(angle)
            const perpY = Math.cos(angle)

            const steps = Math.max(
              Math.ceil((lineLength / wavelength) * 32),
              64
            )

            ctx.beginPath()
            for (let i = 0; i <= steps; i++) {
              const t = i / steps
              const pos = t * lineLength
              const theta = (2 * Math.PI * (pos - lineLength / 2)) / wavelength
              const waveOffset = waveAmplitude * Math.cos(theta)

              const x = currentX + dx * t + perpX * waveOffset
              const y = currentY + dy * t + perpY * waveOffset

              if (i === 0) ctx.moveTo(x, y)
              else ctx.lineTo(x, y)
            }
            ctx.stroke()
            break
          }

          case "zigzag": {
            // ジグザグ（cos位相、中央揃え）: 中央が+A頂点
            const zigAmplitude = strokeWidthPx * 1.5
            const zigPitch = strokeWidthPx * 8

            const perpX = -Math.sin(angle)
            const perpY = Math.cos(angle)

            const center = lineLength / 2
            const peaks: { pos: number; amp: number }[] = []

            peaks.push({ pos: center, amp: zigAmplitude })

            for (let i = 1; center + i * zigPitch < lineLength; i++) {
              const amp = (i % 2 === 0 ? 1 : -1) * zigAmplitude
              peaks.push({
                pos: center + i * zigPitch,
                amp,
              })
            }
            for (let i = 1; center - i * zigPitch > 0; i++) {
              const amp = (i % 2 === 0 ? 1 : -1) * zigAmplitude
              peaks.push({
                pos: center - i * zigPitch,
                amp,
              })
            }

            peaks.sort((peakA, peakB) => peakA.pos - peakB.pos)

            ctx.beginPath()
            ctx.moveTo(currentX, currentY)

            for (const peak of peaks) {
              const t = peak.pos / lineLength
              const baseX = currentX + dx * t
              const baseY = currentY + dy * t
              ctx.lineTo(baseX + perpX * peak.amp, baseY + perpY * peak.amp)
            }

            ctx.lineTo(currentX + dx, currentY + dy)
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
      {
        const rectWidth = element.width * imageWidth
        const rectHeight = element.height * imageHeight
        ctx.strokeRect(currentX, currentY, rectWidth, rectHeight)
      }
      break

    case "ellipse":
      {
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
