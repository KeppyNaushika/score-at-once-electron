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

/**
 * HTML文字列をオフスクリーンBrowserWindowでロードし、capturePageでPNGバッファに変換。
 * 解答用紙のPNG出力・試験変換の模範解答画像生成で共通使用。
 *
 * HTMLはCSSの mm 単位で .page をレイアウトしているが、BrowserWindowは目的の
 * 出力ピクセルサイズに設定し、.page をビューポート全体に引き伸ばす CSS を注入する。
 * SVGの viewBox により自然にスケールされ、目的の解像度でラスタライズされる。
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
      webPreferences: { offscreen: true },
    })
    await win.loadFile(tempHtmlPath)

    // レンダリング完了を待つ
    await new Promise((resolve) => setTimeout(resolve, 500))

    const image = await win.webContents.capturePage({
      x: 0,
      y: 0,
      width: widthPx,
      height: heightPx,
    })

    return image.toPNG()
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
