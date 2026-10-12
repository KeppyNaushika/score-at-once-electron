/**
 * web 版の印刷・PDF出力の窓口。書き出し（`scripts/web/buildWorker.mjs`）が
 * `electron-src/lib/printUtils.ts` をこのファイルに差し替える（同じ名前の口を持つ）。
 *
 * web 版にはオフスクリーンのウィンドウが無く、Worker では HTML を描けない。HTML を画面へ送り、
 * 画面の見えない `iframe` で描いて印刷ダイアログを出す（`web/page/htmlPrinter.ts`）。
 * PDF ファイルが欲しい呼び出し（`printHtmlToPdfFile`）も同じく印刷ダイアログに任せ、
 * 利用者が「PDF に保存」を選ぶ。描くのは同じ Chromium なので、デスクトップ版の printToPDF と
 * 同じベクタの PDF になる（画像にしてから PDF に詰めると、文字と罫線が画素になり、
 * 解答用紙を刷ってから読み取るときの質が落ちる）。
 *
 * printToPDF に渡していた用紙の大きさ・向き・余白は、`@page` にして HTML の末尾に足す
 * （HTML 自身の `@page` より後に置き、デスクトップ版と同じく指定の方を勝たせる）。
 */
import * as path from "path"

import type {
  HtmlPrintPreviewOptions,
  HtmlToPdfFileOptions,
  PrintPageSize,
} from "../../electron-src/lib/printUtils"
import { requestPrintHtml } from "./pageRequests"

/** 余白（インチ） */
interface PrintMargins {
  top: number
  bottom: number
  left: number
  right: number
}

/** `@page` の `size`。mm のオブジェクトは横向きなら縦横を入れ替える（printToPDF と同じ） */
const pageSizeCssOf = (pageSize: PrintPageSize, landscape: boolean) => {
  if (typeof pageSize === "object") {
    const [width, height] = landscape
      ? [pageSize.height, pageSize.width]
      : [pageSize.width, pageSize.height]
    return `${width}mm ${height}mm`
  }
  return `${pageSize} ${landscape ? "landscape" : "portrait"}`
}

const pageCssOf = (
  pageSize: PrintPageSize,
  landscape: boolean,
  margins: PrintMargins | null
) => {
  const marginCss =
    margins === null
      ? ""
      : ` margin: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in;`
  return `@page { size: ${pageSizeCssOf(pageSize, landscape)};${marginCss} }`
}

/** HTML に `@page` を足す */
const preparePrintHtml = (html: string, pageCss: string) => {
  const pageStyle = `<style>${pageCss}</style>`
  return html.includes("</head>")
    ? html.replace("</head>", `${pageStyle}</head>`)
    : `${pageStyle}${html}`
}

/**
 * HTML の印刷ダイアログを出す（利用者が「PDF に保存」を選ぶ）。既定のファイル名は
 * `filePath` の名前。保存ダイアログが返した `filePath` へは書かない
 */
export async function printHtmlToPdfFile(
  options: HtmlToPdfFileOptions
): Promise<void> {
  const margins = options.margins || {}
  await requestPrintHtml({
    html: preparePrintHtml(
      options.html,
      pageCssOf(options.pageSize || "A4", options.landscape || false, {
        top: margins.top ?? 0.2,
        bottom: margins.bottom ?? 0.2,
        left: margins.left ?? 0.2,
        right: margins.right ?? 0.2,
      })
    ),
    title: path.basename(options.filePath, path.extname(options.filePath)),
  })
}

/** HTML の印刷ダイアログを出す。余白は HTML の `@page` に任せる（デスクトップ版と同じ） */
export async function openHtmlPrintPreview(
  options: HtmlPrintPreviewOptions
): Promise<void> {
  await requestPrintHtml({
    html: preparePrintHtml(
      options.html,
      pageCssOf(options.pageSize || "A4", options.landscape || false, null)
    ),
    title: options.title || "個人成績表",
  })
}
