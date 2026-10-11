/**
 * 解答用紙のページを renderer の Canvas で PNG にする（PNG の書き出しと、試験への変換の画像）。
 *
 * プレビューと同じページの SVG（`renderPageSvgHtmls`）を `<img>` に **data: URL** で読ませ、
 * 目的の画素の Canvas に描く。注釈の PNG 化（`annotationSvgRasterizer.ts`）と同じ手で、
 * blob: URL だと foreignObject を含む SVG が Canvas を汚染（taint）して書き出せなくなる。
 *
 * 画像として読ませた SVG は、文書の CSS も MathJax のグリフ定義も見えない。印刷用 HTML
 * （`generatePrintHtml.ts`）が文書に置いているものを、SVG の中へ写してから読ませる。
 */

import type {
  AnswerSheetDefinition,
  RenderMode,
} from "@/types/answerSheetDefinition.types"
import type { ComputedMultiPageLayout } from "@/types/answerSheetLayout.types"

import { renderPageSvgHtmls } from "./generatePrintHtml"

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const SVG_DATA_URL_PREFIX = "data:image/svg+xml;charset=utf-8,"
const MM_PER_INCH = 25.4

/**
 * 印刷用 HTML の CSS（`generatePageCss`）のうち、ページの中身に効く規則。
 * 文書では body から継承していた文字の設定を、SVG では根の要素に置く
 */
const PAGE_CONTENT_CSS = `
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    font-family: "Noto Sans JP", "Hiragino Sans", sans-serif;
    line-height: 1.5;
    tab-size: 4;
    -webkit-font-smoothing: antialiased;
  }
  foreignObject svg[role="img"] { overflow: visible !important; display: inline !important; }`

/** HTML 文字列のページの SVG を、要素として組み立て直す（foreignObject の中の HTML ごと） */
function parsePageSvg(svgHtml: string): SVGSVGElement {
  const container = document.createElement("div")
  container.innerHTML = svgHtml
  const svgElement = container.querySelector("svg")
  if (!svgElement) throw new Error("解答用紙のページの SVG がありません")
  return svgElement
}

/**
 * ページの SVG を、画像として単独で描ける形にする。
 * 大きさを目的の画素に変え（viewBox は mm のまま）、CSS と MathJax のグリフ定義を先頭へ入れる
 */
function toStandaloneSvg(
  svgElement: SVGSVGElement,
  mathJaxDefsHtml: string,
  widthPx: number,
  heightPx: number
): string {
  svgElement.setAttribute("width", String(widthPx))
  svgElement.setAttribute("height", String(heightPx))

  if (mathJaxDefsHtml) {
    const defsContainer = document.createElement("div")
    defsContainer.innerHTML = mathJaxDefsHtml
    const globalCache = defsContainer.querySelector("svg")
    if (globalCache) svgElement.insertBefore(globalCache, svgElement.firstChild)
  }

  const style = document.createElementNS(SVG_NAMESPACE, "style")
  style.textContent = PAGE_CONTENT_CSS
  svgElement.insertBefore(style, svgElement.firstChild)

  return new XMLSerializer().serializeToString(svgElement)
}

/** SVG を白地の Canvas に描いて PNG にする。描けない・大きすぎて PNG にできないときは投げる */
async function drawSvgToPng(
  svgString: string,
  widthPx: number,
  heightPx: number
): Promise<Uint8Array> {
  const svgImage = new Image()
  svgImage.src = `${SVG_DATA_URL_PREFIX}${encodeURIComponent(svgString)}`
  await svgImage.decode()

  const canvas = document.createElement("canvas")
  canvas.width = widthPx
  canvas.height = heightPx
  // 紙に透明は無いので、透過の無い Canvas にする（PNG も RGB になる）
  const ctx = canvas.getContext("2d", { alpha: false })
  if (!ctx) throw new Error("Canvas の 2D コンテキストを取れませんでした")
  // 透過の無い Canvas の初期値は黒。SVG の背景は透明なので、先に白を塗っておく
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, widthPx, heightPx)
  ctx.drawImage(svgImage, 0, 0, widthPx, heightPx)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  )
  if (!blob) {
    throw new Error(
      `解答用紙のページを PNG にできませんでした（${widthPx}×${heightPx} 画素）`
    )
  }
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * 解答用紙の全ページを、`dpi` の解像度の PNG にする（ページ順）。
 * 画素の大きさは用紙の mm から決める（四捨五入）
 */
export async function rasterizeAnswerSheetPages(
  definition: AnswerSheetDefinition,
  multiLayout: ComputedMultiPageLayout,
  renderMode: RenderMode,
  dpi: number
): Promise<Uint8Array[]> {
  const widthPx = Math.round((multiLayout.pageWidthMm / MM_PER_INCH) * dpi)
  const heightPx = Math.round((multiLayout.pageHeightMm / MM_PER_INCH) * dpi)
  const { pageSvgHtmls, mathJaxDefs } = await renderPageSvgHtmls(
    definition,
    multiLayout,
    renderMode
  )

  const pngPages: Uint8Array[] = []
  for (const svgHtml of pageSvgHtmls) {
    const svgString = toStandaloneSvg(
      parsePageSvg(svgHtml),
      mathJaxDefs,
      widthPx,
      heightPx
    )
    pngPages.push(await drawSvgToPng(svgString, widthPx, heightPx))
  }
  return pngPages
}
