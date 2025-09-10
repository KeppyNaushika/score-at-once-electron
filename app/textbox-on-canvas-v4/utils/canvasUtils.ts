/**
 * @fileoverview Canvas描画ユーティリティ
 * @description SVG-Canvas変換、アスペクト比維持スケーリング、デバッグ機能
 */

import { CANVAS_SETTINGS } from "../constants"
import type { SvgRenderResult } from "../types"

/**
 * デバッグプレビュー設定用の状態管理インターフェース
 */
export interface DebugPreviewState {
  setSvgDataUrl: (url: string | null) => void
  setSvgInfo: (info: string) => void
}

/**
 * デバッグプレビューを設定する
 * @param svgElement プレビュー対象のSVG要素
 * @param width SVG幅
 * @param height SVG高さ
 * @param state デバッグ状態管理オブジェクト
 */
export function setupDebugPreview(
  svgElement: SVGSVGElement,
  width: number,
  height: number,
  state: DebugPreviewState,
): void {
  try {
    const svgData = new XMLSerializer().serializeToString(svgElement)
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`
    state.setSvgDataUrl(svgDataUrl)
    state.setSvgInfo(`生成SVG: ${width}x${height}px`)
  } catch (error) {
    state.setSvgDataUrl(null)
    state.setSvgInfo("プレビュー生成エラー")
  }
}

/**
 * SVG要素をCanvasに高品質描画する（アスペクト比維持スケーリング付き）
 * @param svgElement 描画するSVG要素
 * @param ctx Canvas描画コンテキスト
 * @param x 描画開始X座標
 * @param y 描画開始Y座標
 * @param textBoxWidth テキストボックスの幅
 * @param textBoxHeight テキストボックスの高さ
 * @returns Promise<SvgRenderResult> 描画結果
 */
export async function renderSvgToCanvas(
  svgElement: SVGSVGElement,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  textBoxWidth: number,
  textBoxHeight: number,
): Promise<SvgRenderResult> {
  return new Promise((resolve) => {
    try {
      // SVGをBlobに変換（MathJax defs修復付き）
      let svgData = new XMLSerializer().serializeToString(svgElement)
      
      // MathJax要素が含まれている場合は、グローバルdefsを強制追加（Image変換と同じロジック）
      const hasMathJaxElements = svgData.includes('mjx-container') || svgData.includes('<use')
      if (hasMathJaxElements) {
        console.log("🎨 Canvas描画：MathJax要素検出、グローバルdefsを追加")
        
        // ページ全体からMathJax defsを取得
        const globalDefs = document.querySelector('#MJX-SVG-global-cache defs')
        if (globalDefs && globalDefs.innerHTML.length > 10) {
          const defsContent = globalDefs.outerHTML
          console.log(`🎨 Canvas描画：グローバルdefs取得 ${defsContent.length}文字`)
          
          // SVGの開始タグ直後にdefsを強制挿入
          svgData = svgData.replace(
            /(<svg[^>]*>)/,
            `$1${defsContent}`
          )
          console.log("🎨 Canvas描画：defs挿入完了")
        } else {
          console.warn("⚠️ Canvas描画：グローバルdefsが見つかりません")
        }
      }
      
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new Image()

      img.onload = () => {
        try {
          // アスペクト比を維持しながらテキストボックスに合わせてスケーリング
          const originalWidth = img.width
          const originalHeight = img.height

          // スケール計算（アスペクト比維持）
          const scaleX = textBoxWidth / originalWidth
          const scaleY = textBoxHeight / originalHeight
          const scale = Math.min(scaleX, scaleY) // より小さい方を選択してアスペクト比維持

          // スケーリング後のサイズ
          const scaledWidth = originalWidth * scale
          const scaledHeight = originalHeight * scale

          // 中央配置のための位置調整
          const offsetX = (textBoxWidth - scaledWidth) / 2
          const offsetY = (textBoxHeight - scaledHeight) / 2

          // 画像を描画
          ctx.drawImage(
            img,
            x + offsetX,
            y + offsetY,
            scaledWidth,
            scaledHeight,
          )

          // デバッグ用赤枠を描画（測定精度確認用）
          drawDebugBorder(
            ctx,
            x + offsetX,
            y + offsetY,
            scaledWidth,
            scaledHeight,
          )

          URL.revokeObjectURL(svgUrl)
          resolve({
            width: scaledWidth,
            height: scaledHeight,
          })
        } catch (drawError) {
          URL.revokeObjectURL(svgUrl)
          resolve({ width: 0, height: 0 })
        }
      }

      img.onerror = (error) => {
        URL.revokeObjectURL(svgUrl)
        resolve({ width: 0, height: 0 })
      }

      img.src = svgUrl
    } catch (error) {
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
  height: number,
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
 * テキストボックスの枠線を描画する
 * @param ctx Canvas描画コンテキスト
 * @param x X座標
 * @param y Y座標
 * @param width 幅
 * @param height 高さ
 * @param isSelected 選択状態かどうか
 */
export function drawTextBoxBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isSelected: boolean,
): void {
  ctx.save()

  // 枠線の色と太さを設定
  ctx.strokeStyle = isSelected
    ? CANVAS_SETTINGS.SELECTED_BORDER_COLOR
    : CANVAS_SETTINGS.UNSELECTED_BORDER_COLOR
  ctx.lineWidth = isSelected ? 2 : 1
  ctx.setLineDash([])

  // 枠線を描画
  ctx.strokeRect(x, y, width, height)

  // 選択状態の場合は背景も塗る
  if (isSelected) {
    ctx.fillStyle = CANVAS_SETTINGS.SELECTED_BACKGROUND_COLOR
    ctx.fillRect(x, y, width, height)
  }

  ctx.restore()
}

/**
 * 作成中のテキストボックスを描画する（点線）
 * @param ctx Canvas描画コンテキスト
 * @param x X座標
 * @param y Y座標
 * @param width 幅
 * @param height 高さ
 */
export function drawCreatingTextBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save()

  ctx.strokeStyle = CANVAS_SETTINGS.CREATING_BORDER_COLOR
  ctx.lineWidth = 2
  ctx.setLineDash([5, 5]) // 点線パターン
  ctx.strokeRect(x, y, width, height)
  ctx.setLineDash([]) // 点線リセット

  ctx.restore()
}

/**
 * 背景画像をCanvasに描画する
 * @param ctx Canvas描画コンテキスト
 * @param imageUrl 背景画像のURL
 * @returns Promise<void>
 */
export async function drawBackgroundImage(
  ctx: CanvasRenderingContext2D,
  imageUrl: string,
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
