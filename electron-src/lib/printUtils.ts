/**
 * 印刷・PDF出力の窓口
 *
 * 画面で作った HTML をオフスクリーンの BrowserWindow に読み込み、printToPDF で PDF にする。
 * HTML内のMathJaxインライン埋め込みやレンダリング完了待機もここで行う。
 *
 * web 版にはオフスクリーンのウィンドウが無いので、書き出し（`scripts/web/buildWorker.mjs`）が
 * このファイルを `web/worker/htmlPrinting.ts` に差し替える（画面の印刷ダイアログを出す）。
 * 呼び出し側（`exportHandlers.ts`）は両方で同じ。
 */

import { app, BrowserWindow, shell } from "electron"
import * as fsPromises from "fs/promises"
import * as path from "path"

/** 用紙の大きさ。オブジェクトは mm */
export type PrintPageSize = "A4" | "Letter" | { width: number; height: number }

/** HTML を PDF ファイルに書き出すときの指定 */
export interface HtmlToPdfFileOptions {
  html: string
  filePath: string
  pageSize?: PrintPageSize
  landscape?: boolean
  /** 余白（インチ）。既定は各 0.2 インチ（≈5mm） */
  margins?: {
    top?: number
    bottom?: number
    left?: number
    right?: number
  }
}

/** HTML を印刷用に開くときの指定 */
export interface HtmlPrintPreviewOptions {
  html: string
  title?: string
  pageSize?: PrintPageSize
  landscape?: boolean
}

let mathjaxCache: string | null = null

/** MathJax tex-svg.js の内容を読み込む（キャッシュ付き） */
async function getMathJaxSource(): Promise<string> {
  if (mathjaxCache) return mathjaxCache
  const mathjaxPath = app.isPackaged
    ? path.join(process.resourcesPath, "public/js/mathjax/tex-svg.js")
    : path.join(__dirname, "../../../public/js/mathjax/tex-svg.js")
  mathjaxCache = await fsPromises.readFile(mathjaxPath, "utf-8")
  return mathjaxCache
}

/**
 * HTML内の <script src="__MATHJAX_SRC__"></script> を
 * MathJaxソースのインライン埋め込みに置換する。
 * file:// のクロスオリジン制限を回避するため、外部参照ではなくインライン化。
 */
async function resolveMathJaxSrc(html: string): Promise<string> {
  if (!html.includes("__MATHJAX_SRC__")) return html
  try {
    const source = await getMathJaxSource()
    return html.replace(
      '<script src="__MATHJAX_SRC__"></script>',
      `<script>${source}</script>`
    )
  } catch (err) {
    console.error("Failed to load MathJax source:", err)
    return html.replace('<script src="__MATHJAX_SRC__"></script>', "")
  }
}

/** MathJaxの描画完了を待つ。MathJaxがなければ500ms待機 */
async function waitForRendering(win: BrowserWindow): Promise<void> {
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

/** pageSize が mm のオブジェクトなら、printToPDF が受け取るインチに変換する */
function toPrintToPdfPageSize(pageSize: PrintPageSize): PrintPageSize {
  if (typeof pageSize === "object") {
    return { width: pageSize.width / 25.4, height: pageSize.height / 25.4 }
  }
  return pageSize
}

/**
 * HTML をオフスクリーンのウィンドウに読み込んで PDF にする。
 * 一時ファイルにHTMLを書き込んでから読む（data URIは長すぎると失敗するため）
 */
async function renderHtmlToPdf(options: {
  html: string
  tempHtmlPrefix: string
  pageSize: PrintPageSize
  landscape: boolean
  margins: { top: number; bottom: number; left: number; right: number }
}): Promise<Buffer> {
  const tempHtmlPath = path.join(
    app.getPath("temp"),
    `${options.tempHtmlPrefix}-${Date.now()}.html`
  )

  const win = new BrowserWindow({
    width: 794, // A4 at 96 DPI
    height: 1123,
    show: false,
    webPreferences: {
      offscreen: true,
    },
  })

  try {
    // MathJaxパスを解決してHTMLを一時ファイルに書き込み
    const html = await resolveMathJaxSrc(options.html)
    await fsPromises.writeFile(tempHtmlPath, html, "utf-8")

    // 一時HTMLファイルをロード
    await win.loadFile(tempHtmlPath)

    // MathJax描画完了を待つ（MathJaxがなければ500ms待機）
    await waitForRendering(win)

    return await win.webContents.printToPDF({
      pageSize: toPrintToPdfPageSize(options.pageSize),
      landscape: options.landscape,
      printBackground: true,
      margins: options.margins,
    })
  } finally {
    win.destroy()
    // 一時ファイルを削除
    try {
      await fsPromises.unlink(tempHtmlPath)
    } catch {
      // 削除に失敗しても無視
    }
  }
}

/** HTML を PDF にして `filePath` へ書く */
export async function printHtmlToPdfFile(
  options: HtmlToPdfFileOptions
): Promise<void> {
  // マージンはインチ単位、デフォルト5mm ≈ 0.2インチ
  const margins = options.margins || {}
  const pdfBuffer = await renderHtmlToPdf({
    html: options.html,
    tempHtmlPrefix: "report",
    pageSize: options.pageSize || "A4",
    landscape: options.landscape || false,
    margins: {
      top: margins.top ?? 0.2,
      bottom: margins.bottom ?? 0.2,
      left: margins.left ?? 0.2,
      right: margins.right ?? 0.2,
    },
  })
  await fsPromises.writeFile(options.filePath, pdfBuffer)
}

/**
 * HTML を PDF にして既定のアプリ（プレビュー.app など）で開く。利用者はそこから
 * 印刷・保存する
 */
export async function openHtmlPrintPreview(
  options: HtmlPrintPreviewOptions
): Promise<void> {
  const tempPdfPath = path.join(
    app.getPath("temp"),
    `${options.title || "個人成績表"}-${Date.now()}.pdf`
  )
  // マージンはCSSの@page marginに任せるため0に設定
  const pdfBuffer = await renderHtmlToPdf({
    html: options.html,
    tempHtmlPrefix: "print",
    pageSize: options.pageSize || "A4",
    landscape: options.landscape || false,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  })
  // PDFは開いたままにするので削除しない（ユーザーが保存する可能性がある）
  await fsPromises.writeFile(tempPdfPath, pdfBuffer)
  await shell.openPath(tempPdfPath)
}
