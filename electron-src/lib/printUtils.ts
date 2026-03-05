/**
 * 印刷・PDF出力ユーティリティ
 *
 * HTML内のMathJaxインライン埋め込みやレンダリング完了待機など、
 * printToPDF系ハンドラの共通処理を提供する。
 */

import { app, BrowserWindow } from "electron"
import fs from "fs"
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
