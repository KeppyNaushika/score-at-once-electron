/**
 * 印刷・PDF出力ユーティリティ
 *
 * HTML内のMathJaxインライン埋め込みやレンダリング完了待機など、
 * printToPDF系ハンドラの共通処理を提供する。
 */

import { app, BrowserWindow } from "electron"
import fs from "fs"
import os from "os"
import path from "path"
import sharp from "sharp"

let mathjaxCache: string | null = null

/** MathJax tex-svg.js の内容を読み込む（キャッシュ付き） */
function getMathJaxSource(): string {
  if (mathjaxCache) return mathjaxCache
  const mathjaxPath = app.isPackaged
    ? path.join(process.resourcesPath, "public/js/mathjax/tex-svg.js")
    : path.join(__dirname, "../../../public/js/mathjax/tex-svg.js")
  mathjaxCache = fs.readFileSync(mathjaxPath, "utf-8")
  return mathjaxCache
}

/**
 * HTML内の <script src="__MATHJAX_SRC__"></script> を
 * MathJaxソースのインライン埋め込みに置換する。
 * file:// のクロスオリジン制限を回避するため、外部参照ではなくインライン化。
 */
export function resolveMathJaxSrc(html: string): string {
  if (!html.includes("__MATHJAX_SRC__")) return html
  try {
    const src = getMathJaxSource()
    return html.replace(
      '<script src="__MATHJAX_SRC__"></script>',
      `<script>${src}</script>`
    )
  } catch (err) {
    console.error("Failed to load MathJax source:", err)
    return html.replace('<script src="__MATHJAX_SRC__"></script>', "")
  }
}

/** キャプチャ計画: ウィンドウが目標サイズを確保できたかと、実際にキャプチャする矩形 */
export interface CapturePlan {
  /** ウィンドウサイズが画面にクランプされ、縮小キャプチャ→拡大が必要か */
  clamped: boolean
  captureWidth: number
  captureHeight: number
}

/**
 * 実際のウィンドウコンテンツサイズから、アスペクト比を維持したキャプチャ矩形を計算する。
 *
 * WindowsやLinuxではBrowserWindowの作成サイズが画面の作業領域にクランプされる
 * （enableLargerThanScreenはmacOS専用。ref: electron/electron#20351, #30154）。
 * クランプされた場合は、目標アスペクト比を維持できる最大の矩形でキャプチャし、
 * 後段でsharpにより目標ピクセルサイズへ拡大する。
 */
export function computeCapturePlan(
  targetWidth: number,
  targetHeight: number,
  contentWidth: number,
  contentHeight: number
): CapturePlan {
  if (contentWidth >= targetWidth && contentHeight >= targetHeight) {
    return {
      clamped: false,
      captureWidth: targetWidth,
      captureHeight: targetHeight,
    }
  }
  const fit = Math.min(contentWidth / targetWidth, contentHeight / targetHeight)
  return {
    clamped: true,
    captureWidth: Math.max(1, Math.floor(targetWidth * fit)),
    captureHeight: Math.max(1, Math.floor(targetHeight * fit)),
  }
}

/**
 * HTML文字列をオフスクリーンBrowserWindowでロードし、capturePageでPNGバッファに変換。
 * 解答用紙のPNG出力・試験変換の模範解答画像生成で共通使用。
 *
 * HTMLはCSSの mm 単位で .page をレイアウトしているが、BrowserWindowは目的の
 * 出力ピクセルサイズに設定し、.page をビューポート全体に引き伸ばす CSS を注入する。
 * SVGの viewBox により自然にスケールされ、目的の解像度でラスタライズされる。
 *
 * ウィンドウサイズが画面にクランプされた環境（Windows/Linux）では、
 * アスペクト比を維持した縮小キャプチャ→拡大にフォールバックし、
 * どの環境でも必ず目標ピクセルサイズ・正しいアスペクト比のPNGを返す。
 */
export async function htmlToPngBuffer(
  html: string,
  pageWidthMm: number,
  pageHeightMm: number,
  dpi: number = 300
): Promise<Buffer> {
  const widthPx = Math.round((pageWidthMm / 25.4) * dpi)
  const heightPx = Math.round((pageHeightMm / 25.4) * dpi)

  // .page を固定 mm サイズからビューポート全体に拡張する CSS を注入
  const overrideCss = `<style>.page { width: 100vw !important; height: 100vh !important; }</style>`
  const modifiedHtml = html.replace("</head>", `${overrideCss}\n</head>`)

  let tempHtmlPath: string | null = null
  let win: BrowserWindow | null = null
  try {
    tempHtmlPath = path.join(
      os.tmpdir(),
      `asb-capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`
    )
    fs.writeFileSync(tempHtmlPath, modifiedHtml, "utf-8")

    win = new BrowserWindow({
      show: false,
      width: widthPx,
      height: heightPx,
      frame: false,
      useContentSize: true,
      enableLargerThanScreen: true,
      webPreferences: { offscreen: true },
    })
    // Windows/Linuxでは作成時サイズが画面にクランプされるため、作成後に再設定する
    win.setContentSize(widthPx, heightPx)
    await win.loadFile(tempHtmlPath)

    const [contentWidth, contentHeight] = win.getContentSize()
    const plan = computeCapturePlan(
      widthPx,
      heightPx,
      contentWidth,
      contentHeight
    )

    if (plan.clamped) {
      console.warn(
        `[htmlToPngBuffer] ウィンドウが ${contentWidth}x${contentHeight} にクランプされたため、` +
          `${plan.captureWidth}x${plan.captureHeight} でキャプチャして ${widthPx}x${heightPx} へ拡大します`
      )
      // 100vw/100vh の引き伸ばしはアスペクト比が崩れるため、
      // アスペクト比を維持した固定pxサイズで左上に配置し直す
      await win.webContents.insertCSS(
        `.page { width: ${plan.captureWidth}px !important; height: ${plan.captureHeight}px !important; ` +
          `position: fixed !important; top: 0 !important; left: 0 !important; }`
      )
    }

    // レンダリング完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 500))

    const image = await win.webContents.capturePage({
      x: 0,
      y: 0,
      width: plan.captureWidth,
      height: plan.captureHeight,
    })
    const buffer = image.toPNG()

    // 出力を必ず目標ピクセルサイズに正規化する
    // （クランプ時の拡大と、Retina環境でcapturePageが2倍解像度を返すケースの両方を吸収）
    const metadata = await sharp(buffer).metadata()
    if (metadata.width === widthPx && metadata.height === heightPx) {
      return buffer
    }
    return sharp(buffer)
      .resize(widthPx, heightPx, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer()
  } finally {
    win?.destroy()
    if (tempHtmlPath) {
      try {
        fs.unlinkSync(tempHtmlPath)
      } catch {
        // ignore
      }
    }
  }
}

/** MathJaxの描画完了を待つ。MathJaxがなければ500ms待機 */
export async function waitForRendering(win: BrowserWindow): Promise<void> {
  const hasMathJax = await win.webContents.executeJavaScript(
    "typeof window.MathJax !== 'undefined'"
  )
  if (!hasMathJax) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return
  }
  // MathJaxの startup.promise が解決されるまでポーリング（最大10秒）
  const timeout = 10_000
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const ready = await win.webContents.executeJavaScript(
      "window.__mathjax_ready === true"
    )
    if (ready) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  console.warn("MathJax rendering timeout, proceeding with PDF generation")
}
