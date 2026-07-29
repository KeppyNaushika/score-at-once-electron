/**
 * @fileoverview Canvas描画ユーティリティ
 * @description SVG-Canvas変換、アスペクト比維持スケーリング、デバッグ機能
 */

import { CANVAS_SETTINGS } from "./constants"
import type { AnchorDirection, Point, SvgRenderResult } from "./types"

/**
 * SVG要素をCanvasに高品質描画する（実測サイズベース）
 * @param svgElement 描画するSVG要素
 * @param ctx Canvas描画コンテキスト
 * @param anchorX アンカーのX座標
 * @param anchorY アンカーのY座標
 * @param anchorDirection アンカー方向
 * @param showDebugBorder デバッグ用枠線を表示するか（デフォルト: false）
 * @param opacity 描画透明度（0.0-1.0、デフォルト1.0）
 * @returns Promise<SvgRenderResult> 描画結果
 */
export async function renderSvgToCanvas(
  svgElement: SVGSVGElement,
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  anchorDirection: AnchorDirection,
  showDebugBorder: boolean = false,
  opacity: number = 1.0
): Promise<SvgRenderResult> {
  return new Promise((resolve) => {
    try {
      // SVGをBlobに変換（MathJax defs修復付き）
      let svgData = new XMLSerializer().serializeToString(svgElement)

      // MathJax要素が含まれている場合は、グローバルdefsを強制追加（Image変換と同じロジック）
      const hasMathJaxElements =
        svgData.includes("mjx-container") || svgData.includes("<use")
      if (hasMathJaxElements) {
        // ページ全体からMathJax defsを取得
        const globalDefs = document.querySelector("#MJX-SVG-global-cache defs")
        if (globalDefs && globalDefs.innerHTML.length > 10) {
          const defsContent = globalDefs.outerHTML
          // SVGの開始タグ直後にdefsを強制挿入
          svgData = svgData.replace(/(<svg[^>]*>)/, `$1${defsContent}`)
        }
      }

      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new Image()

      img.onload = () => {
        try {
          // 実際のSVGサイズをそのまま使用（fontSizeは生成時に適用済み）
          const width = img.width
          const height = img.height

          // アンカー方向に基づいて描画位置を計算
          const textPosition = getTextPositionFromAnchor(
            anchorX,
            anchorY,
            width,
            height,
            anchorDirection
          )

          // 透明度を適用して画像を描画
          ctx.save()
          ctx.globalAlpha = opacity
          ctx.drawImage(img, textPosition.x, textPosition.y, width, height)
          ctx.restore()

          // デバッグ用赤枠を描画（実際のテキスト領域）- 透明度なし
          if (showDebugBorder) {
            drawDebugBorder(ctx, textPosition.x, textPosition.y, width, height)
          }

          URL.revokeObjectURL(svgUrl)
          resolve({
            width: width,
            height: height,
          })
        } catch {
          URL.revokeObjectURL(svgUrl)
          resolve({ width: 0, height: 0 })
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        resolve({ width: 0, height: 0 })
      }

      img.src = svgUrl
    } catch {
      resolve({ width: 0, height: 0 })
    }
  })
}

/**
 * デバッグ用の境界線を描画する
 * @param ctx Canvas描画コンテキスト
 * @param x X座標
 * @param y Y座標
 * @param width 幅
 * @param height 高さ
 */
function drawDebugBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  ctx.save()
  ctx.strokeStyle = CANVAS_SETTINGS.DEBUG_BORDER_COLOR
  ctx.lineWidth = CANVAS_SETTINGS.DEBUG_BORDER_WIDTH
  ctx.setLineDash([])
  ctx.strokeRect(x, y, width, height)

  // DIVに赤枠サイズを表示
  const redBorderDisplay = document.getElementById("red-border-display")
  if (redBorderDisplay) {
    redBorderDisplay.innerHTML = `
      <div class="bg-red-50 p-2 rounded border border-red-200">
        <div class="font-medium text-red-700 mb-1">🔴 実際の赤枠サイズ</div>
        <div class="text-sm">
          <div>位置: (${Math.round(x)}, ${Math.round(y)})</div>
          <div>サイズ: <span class="font-bold text-red-800">${Math.round(width)} × ${Math.round(height)}px</span></div>
        </div>
      </div>
    `
  }

  ctx.restore()
}

/**
 * LucideのAnchorアイコンをCanvasに描画する
 * @param ctx Canvas描画コンテキスト
 * @param x アンカーのX座標
 * @param y アンカーのY座標
 * @param isSelected 選択状態かどうか
 */
export async function drawAnchor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isSelected: boolean
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const size = CANVAS_SETTINGS.ANCHOR_RADIUS * 2
      const strokeColor = isSelected ? "#1d4ed8" : "#2563eb"

      // AnchorアイコンのSVGを生成
      const svgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="5" r="3"/>
          <path d="M12 22V8"/>
          <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
        </svg>
      `

      const svgBlob = new Blob([svgContent], {
        type: "image/svg+xml;charset=utf-8",
      })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        try {
          // アンカーアイコンを中央に配置
          const drawX = x - size / 2
          const drawY = y - size / 2

          ctx.drawImage(img, drawX, drawY, size, size)
          URL.revokeObjectURL(svgUrl)
          resolve()
        } catch {
          URL.revokeObjectURL(svgUrl)
          resolve()
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(svgUrl)
        resolve()
      }

      img.src = svgUrl
    } catch {
      resolve()
    }
  })
}

/**
 * アンカー方向に基づいてテキストの描画位置を計算する
 * @param anchorX アンカーのX座標
 * @param anchorY アンカーのY座標
 * @param textWidth テキストの幅
 * @param textHeight テキストの高さ
 * @param anchorDirection アンカー方向
 * @returns 計算された描画位置
 */
export function getTextPositionFromAnchor(
  anchorX: number,
  anchorY: number,
  textWidth: number,
  textHeight: number,
  anchorDirection: AnchorDirection
): Point {
  let x = anchorX
  let y = anchorY

  // 水平方向の調整
  switch (anchorDirection) {
    case "top-left":
    case "left":
    case "bottom-left":
      // アンカーがテキストの左端
      break
    case "top":
    case "center":
    case "bottom":
      // アンカーがテキストの中央
      x = anchorX - textWidth / 2
      break
    case "top-right":
    case "right":
    case "bottom-right":
      // アンカーがテキストの右端
      x = anchorX - textWidth
      break
  }

  // 垂直方向の調整
  switch (anchorDirection) {
    case "top-left":
    case "top":
    case "top-right":
      // アンカーがテキストの上端
      break
    case "left":
    case "center":
    case "right":
      // アンカーがテキストの中央
      y = anchorY - textHeight / 2
      break
    case "bottom-left":
    case "bottom":
    case "bottom-right":
      // アンカーがテキストの下端
      y = anchorY - textHeight
      break
  }

  return { x, y }
}

/**
 * 背景画像をCanvasに描画する
 * @param ctx Canvas描画コンテキスト
 * @param imageUrl 背景画像のURL
 * @returns Promise<void>
 */
export async function drawBackgroundImage(
  ctx: CanvasRenderingContext2D,
  imageUrl: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0)
        resolve()
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = (error) => {
      reject(error)
    }

    img.src = imageUrl
  })
}
