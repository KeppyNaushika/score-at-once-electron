/**
 * 解答用紙の印刷/PDF出力用HTML生成
 *
 * 個人成績表と同じパターン: renderToStaticMarkup でReactコンポーネントをHTML化し、
 * BrowserWindow + printToPDF で出力する。
 * MathJaxはレンダラープロセスで事前にSVG化するため、出力HTMLにはMathJax不要。
 */

import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"
import type { ComputedMultiPageLayout } from "@/types/answerSheetLayout.types"

import { AnswerSheetSVGRenderer } from "../components/preview/AnswerSheetSVGRenderer"
import { resolveImageDataUris } from "./renderSvgStrings"

/**
 * 解答用紙の印刷用HTMLを生成する。
 * プレビューと同じ AnswerSheetSVGRenderer を renderToStaticMarkup で使用。
 */
export async function generateAnswerSheetPrintHtml(
  definition: AnswerSheetDefinition,
  multiLayout: ComputedMultiPageLayout
): Promise<string> {
  const { pageWidthMm, pageHeightMm } = multiLayout

  // 画像の data URI を事前解決
  const allCells = multiLayout.pages.flatMap((p) => p.cells)
  const imageDataUris = await resolveImageDataUris(allCells)

  // 各ページを renderToStaticMarkup で HTML 化
  // （renderSegmentsHtmlForPrint 内で MathJax.tex2svg() が呼ばれ、
  //   グリフ定義がグローバルSVGキャッシュに蓄積される）
  const pagesHtml = multiLayout.pages
    .map((page, i) => {
      const svgHtml = renderToStaticMarkup(
        React.createElement(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: pageWidthMm,
            height: pageHeightMm,
            viewBox: `0 0 ${pageWidthMm} ${pageHeightMm}`,
          },
          React.createElement(AnswerSheetSVGRenderer, {
            layout: {
              pageWidthMm,
              pageHeightMm,
              cells: page.cells,
              lines: page.lines,
              numberLabels: page.numberLabels,
              omrMarkerPositions: page.omrMarkerPositions,
              headerFields: page.headerFields,
              overflow: false,
              contentHeightMm: pageHeightMm,
            },
            pageLayout: page,
            renderMode: definition.renderMode,
            forPrint: true,
            imageDataUris,
          })
        )
      )

      const isLast = i === multiLayout.pages.length - 1
      const pageBreak = isLast ? "" : " page-break-after"
      return `<div class="page${pageBreak}">${svgHtml}</div>`
    })
    .join("\n")

  // MathJaxのグローバルSVGキャッシュ（グリフ定義）を取得
  // tex2svg()が生成するSVGは <use xlink:href="#MJX-..."> で共有グリフを参照するため、
  // そのグリフ定義 (<defs>) を print HTML に含める必要がある
  let mathJaxDefs = ""
  if (typeof document !== "undefined") {
    const defsContainer = document.querySelector("#MJX-SVG-global-cache")
    if (defsContainer) {
      mathJaxDefs = defsContainer.outerHTML
    }
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>
  @page {
    size: ${pageWidthMm}mm ${pageHeightMm}mm;
    margin: 0;
  }
  /* Tailwind preflight相当のCSS（プレビューと同じ環境を再現） */
  *, *::before, *::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  html {
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
    tab-size: 4;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: "Noto Sans JP", "Hiragino Sans", sans-serif;
    line-height: inherit;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .page {
    width: ${pageWidthMm}mm;
    height: ${pageHeightMm}mm;
    overflow: hidden;
  }
  .page-break-after { page-break-after: always; }
  .page > svg { display: block; width: 100%; height: 100%; }
  /* MathJax SVGのベースライン以下の切れ防止 */
  foreignObject svg[role="img"] { overflow: visible !important; display: inline !important; }
</style>
</head>
<body>
${mathJaxDefs}
${pagesHtml}
</body>
</html>`
}
