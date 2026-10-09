/**
 * 注釈テキストの SVG を renderer の Canvas でラスタライズする
 *
 * 注釈の SVG（`convertTextToSvg` の出力）は foreignObject の中に HTML と MathJax の
 * SVG を持つ。これを `<img>` に **data: URL** で読ませて Canvas に描く。
 * blob: URL で読ませると foreignObject を含む SVG は Canvas を汚染（taint）し、
 * 用紙の Canvas ごと toBlob できなくなる。data: URL なら汚染しない
 * （Electron 43 / Chromium 150 で実測）。
 */

const SVG_DATA_URL_PREFIX = "data:image/svg+xml;charset=utf-8,"

/** ラスタライズした注釈と、用紙の Canvas へ描くときの大きさ（Canvas の画素） */
interface RasterizedAnnotationSvg {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

/**
 * MathJax のグリフ定義（defs）を SVG の先頭へ写す。
 *
 * MathJax は fontCache: 'global' で、グリフを `#MJX-SVG-global-cache` に1度だけ
 * 置き、各数式は `<use>` で参照する。`convertTextToSvg` の出力はこの defs を
 * 持たないので、単独の画像として読ませる前に同じ文書へ入れておく。
 */
function embedMathJaxDefs(svgElement: SVGSVGElement): void {
  const hasMathJaxElements =
    svgElement.querySelector("mjx-container, use") !== null
  if (!hasMathJaxElements) return

  const globalDefs = document.querySelector("#MJX-SVG-global-cache defs")
  if (!globalDefs || globalDefs.innerHTML.length <= 10) return

  svgElement.insertBefore(
    svgElement.ownerDocument.importNode(globalDefs, true),
    svgElement.firstChild
  )
}

/** SVG の width / height 属性（px）を読む。読めなければ投げる。 */
function readSvgLength(
  svgElement: SVGSVGElement,
  attributeName: "width" | "height"
): number {
  const length = Number.parseFloat(svgElement.getAttribute(attributeName) ?? "")
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error(`SVG has no valid ${attributeName}`)
  }
  return length
}

/**
 * 注釈の SVG を、透過のまま SVG の大きさ（1 SVG px = 1 Canvas 画素）の Canvas に描く。
 *
 * 大きさは width / height の切り上げ。用紙の Canvas は答案画像の画素で組まれ、
 * 文字の大きさも画像の画素で決まっている（mm → px）ので、devicePixelRatio は
 * 掛けない。描画や読み込みに失敗したとき、Canvas が汚染されたときは投げる。
 */
export async function rasterizeAnnotationSvg(
  svgElement: SVGSVGElement
): Promise<RasterizedAnnotationSvg> {
  embedMathJaxDefs(svgElement)

  const svgWidth = readSvgLength(svgElement, "width")
  const svgHeight = readSvgLength(svgElement, "height")
  const width = Math.ceil(svgWidth)
  const height = Math.ceil(svgHeight)

  const svgString = new XMLSerializer().serializeToString(svgElement)
  const svgImage = new Image()
  svgImage.src = `${SVG_DATA_URL_PREFIX}${encodeURIComponent(svgString)}`
  await svgImage.decode()

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Failed to get 2D context for SVG rasterization")
  ctx.drawImage(svgImage, 0, 0, svgWidth, svgHeight)

  // 汚染されていれば SecurityError を投げる。用紙の Canvas へ描く前にここで
  // 止め、その注釈だけを文字のフォールバックへ回す（用紙ごと書き出せなくなるのを防ぐ）。
  ctx.getImageData(0, 0, 1, 1)

  return { canvas, width, height }
}
