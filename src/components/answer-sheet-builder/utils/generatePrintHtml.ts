/**
 * 解答用紙の印刷/PDF出力用HTML生成
 *
 * 個人成績表と同じパターン: renderToStaticMarkup でReactコンポーネントをHTML化し、
 * BrowserWindow + printToPDF で出力する。
 * MathJaxはレンダラープロセスで事前にSVG化するため、出力HTMLにはMathJax不要。
 */

import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type {
  AnswerSheetDefinition,
  RenderMode,
} from "@/types/answerSheetDefinition.types"
import type { ComputedMultiPageLayout } from "@/types/answerSheetLayout.types"

import { AnswerSheetSVGRenderer } from "../components/preview/AnswerSheetSVGRenderer"
import { resolveImageDataUris } from "./renderSvgStrings"

/**
 * ページごとのSVG HTML文字列と MathJax defs を生成する内部ヘルパー
 */
async function renderPageSvgHtmls(
  definition: AnswerSheetDefinition,
  multiLayout: ComputedMultiPageLayout,
  renderMode: RenderMode
): Promise<{ pageSvgHtmls: string[]; mathJaxDefs: string }> {
  const { pageWidthMm, pageHeightMm } = multiLayout

  // 画像の data URI を事前解決
  const allCells = multiLayout.pages.flatMap((page) => page.cells)
  const imageDataUris = await resolveImageDataUris(allCells)

  // 各ページを renderToStaticMarkup で HTML 化
  // （renderSegmentsHtmlForPrint 内で MathJax.tex2svg() が呼ばれ、
  //   グリフ定義がグローバルSVGキャッシュに蓄積される）
  const pageSvgHtmls = multiLayout.pages.map((page) =>
    renderToStaticMarkup(
      React.createElement(
        "svg",
        {
          xmlns: "http://www.w3.org/2000/svg",
          width: pageWidthMm,
          height: pageHeightMm,
          viewBox: `0 0 ${pageWidthMm} ${pageHeightMm}`,
          preserveAspectRatio: "xMinYMin meet",
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
          renderMode,
          forPrint: true,
          imageDataUris,
          borderConfig: definition.settings.borderConfig,
        })
      )
    )
  )

  // MathJaxのグローバルSVGキャッシュ（グリフ定義）を取得
  let mathJaxDefs = ""
  if (typeof document !== "undefined") {
    const defsContainer = document.querySelector("#MJX-SVG-global-cache")
    if (defsContainer) {
      mathJaxDefs = defsContainer.outerHTML
    }
  }

  return { pageSvgHtmls, mathJaxDefs }
}

/** ページ用の共通CSSを生成 */
function generatePageCss(pageWidthMm: number, pageHeightMm: number): string {
  return `
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
  foreignObject svg[role="img"] { overflow: visible !important; display: inline !important; }`
}

/**
 * 解答用紙の全ページを含む印刷用HTML文書を生成する。
 *
 * `renderModes` を2つ渡すと、1つの文書に続けて綴じる（解答用紙の全ページ →
 * 模範解答の全ページ）。**どちらの姿で出すかは書き出しの指定で、解答用紙が持つ
 * 性質ではない**ので、既定は置かず必ず受け取る。
 */
export async function generateAnswerSheetPrintHtml(
  definition: AnswerSheetDefinition,
  multiLayout: ComputedMultiPageLayout,
  renderModes: readonly RenderMode[]
): Promise<string> {
  const { pageWidthMm, pageHeightMm } = multiLayout
  const pageSvgHtmls: string[] = []
  // MathJax のグリフ定義はグローバルに溜まるので、最後に取れたものが全部を含む
  let mathJaxDefs = ""
  for (const renderMode of renderModes) {
    const rendered = await renderPageSvgHtmls(
      definition,
      multiLayout,
      renderMode
    )
    pageSvgHtmls.push(...rendered.pageSvgHtmls)
    mathJaxDefs = rendered.mathJaxDefs
  }

  const pagesHtml = pageSvgHtmls
    .map((svgHtml, i) => {
      const isLast = i === pageSvgHtmls.length - 1
      const pageBreak = isLast ? "" : " page-break-after"
      return `<div class="page${pageBreak}">${svgHtml}</div>`
    })
    .join("\n")

  const css = generatePageCss(pageWidthMm, pageHeightMm)

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>${css}
</style>
</head>
<body>
${mathJaxDefs}
${pagesHtml}
</body>
</html>`
}

/** 解答用紙の各ページを個別のHTML文書として生成する（PNG出力用） */
export async function generateAnswerSheetPageHtmls(
  definition: AnswerSheetDefinition,
  multiLayout: ComputedMultiPageLayout,
  renderMode: RenderMode
): Promise<string[]> {
  const { pageWidthMm, pageHeightMm } = multiLayout
  const { pageSvgHtmls, mathJaxDefs } = await renderPageSvgHtmls(
    definition,
    multiLayout,
    renderMode
  )

  const css = generatePageCss(pageWidthMm, pageHeightMm)

  return pageSvgHtmls.map(
    (svgHtml) => `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>${css}
</style>
</head>
<body>
${mathJaxDefs}
<div class="page">${svgHtml}</div>
</body>
</html>`
  )
}
