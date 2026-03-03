/**
 * SVG文字列生成（renderer側）
 *
 * ComputedLayoutからSVG文字列を生成する。
 * main側に渡してsharpでPNG化、またはprintToPDFでPDF化する。
 */

import {
  parseInlineMarkup,
  stripMarkup,
} from "@/lib/answer-sheet-builder/inlineMarkupParser"
import type {
  ComputedCell,
  ComputedLine,
  ComputedMultiPageLayout,
  ComputedPageLayout,
  LineStyle,
  RenderMode,
} from "@/types/answerSheetBuilder.types"

/** mm → SVGのpx変換（出力DPIに応じて外部でスケーリング） */
const MM_SCALE = 1

/**
 * 破線/点線のSVG属性を生成（中央基準パターン）
 * - 破線: dash = sw*3, gap = sw*2
 * - 点線: dash = 0.01, gap = sw*2
 * lineLength を渡すと stroke-dashoffset で中央対称にする
 */
function lineDashAttrs(
  style: LineStyle,
  strokeWidth: number,
  lineLength: number
): string {
  let dash: number, gap: number
  switch (style) {
    case "dashed":
      dash = strokeWidth * 3
      gap = strokeWidth * 2
      break
    case "dotted":
      dash = 0.01
      gap = strokeWidth * 2
      break
    default:
      return ""
  }
  const period = dash + gap
  const offset = ((lineLength / 2) % period) - dash / 2
  return `stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${offset}" stroke-linecap="round"`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** テキスト要素をインラインマークアップ対応でSVG tspan群に変換 */
function renderTextElementTspans(text: string, renderMode: RenderMode): string {
  const segments = parseInlineMarkup(text)
  const filtered = segments.filter(
    (seg) => !seg.modelAnswer || renderMode === "model-answer"
  )
  if (filtered.length === 0) return ""

  return filtered
    .map((seg) => {
      const attrs: string[] = []
      if (seg.bold) attrs.push('font-weight="bold"')
      if (seg.italic) attrs.push('font-style="italic"')
      if (seg.strikethrough) attrs.push('text-decoration="line-through"')
      if (seg.modelAnswer) attrs.push('fill="#d00"')
      const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : ""
      return `<tspan${attrStr}>${escapeXml(seg.text)}</tspan>`
    })
    .join("")
}

/** 単一ページのSVG文字列を生成 */
function renderPageSvgString(
  pageLayout: ComputedPageLayout,
  pageWidthMm: number,
  pageHeightMm: number,
  renderMode: RenderMode = "answer-sheet"
): string {
  const w = pageWidthMm * MM_SCALE
  const h = pageHeightMm * MM_SCALE
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  )

  parts.push(`<rect width="${w}" height="${h}" fill="white"/>`)

  for (const marker of pageLayout.omrMarkerPositions) {
    parts.push(
      `<rect x="${marker.x}" y="${marker.y}" width="${marker.size}" height="${marker.size}" fill="black"/>`
    )
  }

  for (const line of pageLayout.lines) {
    parts.push(renderLine(line))
  }

  for (const label of pageLayout.numberLabels) {
    const cx = label.x + label.width / 2
    const cy = label.y + label.height / 2
    parts.push(
      `<text x="${cx}" y="${cy}" font-size="${label.fontSize}" font-family="'Noto Sans JP', sans-serif" text-anchor="middle" dominant-baseline="central">${escapeXml(label.text)}</text>`
    )
  }

  for (const cell of pageLayout.cells) {
    if (cell.cellType !== "answer") continue
    for (const te of cell.textElements) {
      // マークアップ記法を除いたプレーンテキストが空なら表示しない
      const plainText = stripMarkup(te.text)
      if (!plainText) continue

      // 模範解答のみのテキスト要素は model-answer モード以外で非表示
      const segments = parseInlineMarkup(te.text)
      const visibleSegments = segments.filter(
        (seg) => !seg.modelAnswer || renderMode === "model-answer"
      )
      if (visibleSegments.length === 0) continue

      const tx =
        te.horizontalAlign === "left"
          ? cell.x + 2
          : te.horizontalAlign === "right"
            ? cell.x + cell.width - 2
            : cell.x + cell.width / 2
      const ty =
        te.verticalAlign === "top"
          ? cell.y + te.fontSize
          : te.verticalAlign === "bottom"
            ? cell.y + cell.height - 2
            : cell.y + cell.height / 2
      const anchor =
        te.horizontalAlign === "left"
          ? "start"
          : te.horizontalAlign === "right"
            ? "end"
            : "middle"
      const baseline =
        te.verticalAlign === "top"
          ? "hanging"
          : te.verticalAlign === "bottom"
            ? "auto"
            : "central"

      const tspans = renderTextElementTspans(te.text, renderMode)
      parts.push(
        `<text x="${tx}" y="${ty}" font-size="${te.fontSize}" font-family="'Noto Sans JP', sans-serif" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="#000">${tspans}</text>`
      )
    }
  }

  // OMRバブル
  for (const cell of pageLayout.cells) {
    parts.push(...renderOMRBubbles(cell, pageWidthMm, pageHeightMm))
  }

  // OMR数字欄
  for (const cell of pageLayout.cells) {
    parts.push(...renderOMRDigitBoxes(cell, pageWidthMm, pageHeightMm))
  }

  // 原稿用紙グリッド
  for (const cell of pageLayout.cells) {
    parts.push(...renderManuscriptGrid(cell))
  }

  parts.push("</svg>")
  return parts.join("\n")
}

/** 複数ページのSVG文字列を一括生成 */
export function renderMultiPageSvgStrings(
  multiPageLayout: ComputedMultiPageLayout,
  renderMode: RenderMode = "answer-sheet"
): string[] {
  return multiPageLayout.pages.map((page) =>
    renderPageSvgString(
      page,
      multiPageLayout.pageWidthMm,
      multiPageLayout.pageHeightMm,
      renderMode
    )
  )
}

/** PDF/印刷用: SVG群をHTML文字列にラップ */
export function wrapSvgsInHtml(
  svgStrings: string[],
  pageWidthMm: number,
  pageHeightMm: number
): string {
  const pages = svgStrings
    .map((svg) => `<div class="page">${svg}</div>`)
    .join("\n")

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: ${pageWidthMm}mm ${pageHeightMm}mm;
    margin: 0;
  }
  * { margin: 0; padding: 0; }
  body { margin: 0; padding: 0; }
  .page {
    width: ${pageWidthMm}mm;
    height: ${pageHeightMm}mm;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }
  svg { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
${pages}
</body>
</html>`
}

function renderLine(line: ComputedLine): string {
  const sw = line.strokeWidth ?? 0.5
  const len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
  const dashAttr = lineDashAttrs(line.style, sw, len)
  return `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="black" stroke-width="${sw}" ${dashAttr}/>`
}

function renderOMRBubbles(
  cell: ComputedCell,
  pageWidthMm: number,
  pageHeightMm: number
): string[] {
  if (!cell.omrBubbles || cell.omrBubbles.length === 0) return []
  const parts: string[] = []
  for (const bubble of cell.omrBubbles) {
    const cx = bubble.normalizedCx * pageWidthMm
    const cy = bubble.normalizedCy * pageHeightMm
    const r = bubble.normalizedRadius * pageWidthMm
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="black" stroke-width="0.3"/>`
    )
    parts.push(
      `<text x="${cx}" y="${cy + r + 2}" font-size="2.5" font-family="'Noto Sans JP', sans-serif" text-anchor="middle" dominant-baseline="hanging" fill="#333">${escapeXml(bubble.label)}</text>`
    )
  }
  return parts
}

function renderOMRDigitBoxes(
  cell: ComputedCell,
  pageWidthMm: number,
  pageHeightMm: number
): string[] {
  if (!cell.omrDigitBoxes || cell.omrDigitBoxes.length === 0) return []
  const parts: string[] = []
  for (const box of cell.omrDigitBoxes) {
    const x = box.normalizedX * pageWidthMm
    const y = box.normalizedY * pageHeightMm
    const w = box.normalizedW * pageWidthMm
    const h = box.normalizedH * pageHeightMm
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#666" stroke-width="0.3"/>`
    )
  }
  return parts
}

function renderManuscriptGrid(cell: ComputedCell): string[] {
  if (!cell.manuscriptGrid) return []
  const g = cell.manuscriptGrid
  const lines: string[] = []
  for (let col = 1; col < g.columns; col++) {
    const x = g.gridX + col * g.cellSizeMm
    lines.push(
      `<line x1="${x}" y1="${g.gridY}" x2="${x}" y2="${g.gridY + g.gridHeight}" stroke="#ccc" stroke-width="0.2"/>`
    )
  }
  for (let row = 1; row < g.rows; row++) {
    const y = g.gridY + row * g.cellSizeMm
    lines.push(
      `<line x1="${g.gridX}" y1="${y}" x2="${g.gridX + g.gridWidth}" y2="${y}" stroke="#ccc" stroke-width="0.2"/>`
    )
  }
  return lines
}
