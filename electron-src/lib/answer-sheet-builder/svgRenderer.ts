/**
 * SVG文字列生成（サーバーサイド）
 *
 * ComputedLayoutからSVG文字列を生成する。
 * PNG生成時にsharpでラスタライズする際に使用。
 */

import type {
  ComputedCell,
  ComputedLayout,
  ComputedLine,
  ComputedMultiPageLayout,
  ComputedPageLayout,
  LineStyle,
  RenderMode,
} from "../../../types/answerSheetBuilder.types"

/** mm → SVGのpx変換（出力DPIに応じて外部でスケーリング） */
const MM_SCALE = 1

/**
 * 破線/点線のSVG属性を生成（中央基準パターン）
 * - 破線: dash = sw*3, gap = sw*1
 * - 点線: dash = sw*1, gap = sw*1
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
      gap = strokeWidth * 1
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

export function renderSvgString(
  layout: ComputedLayout,
  renderMode: RenderMode = "answer-sheet"
): string {
  const w = layout.pageWidthMm * MM_SCALE
  const h = layout.pageHeightMm * MM_SCALE
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  )

  // 白背景
  parts.push(`<rect width="${w}" height="${h}" fill="white"/>`)

  // OMRマーカー
  for (const marker of layout.omrMarkerPositions) {
    parts.push(
      `<rect x="${marker.x}" y="${marker.y}" width="${marker.size}" height="${marker.size}" fill="black"/>`
    )
  }

  // 罫線
  for (const line of layout.lines) {
    parts.push(renderLine(line))
  }

  // 番号ラベル
  for (const label of layout.numberLabels) {
    if (
      label.displayMode === "sub-horizontal" ||
      label.displayMode === "branch-horizontal"
    ) {
      // 横配置時の小問ラベル: セル内左側に配置
      const lx = label.x + 1
      const ly = label.y + label.height / 2
      parts.push(
        `<text x="${lx}" y="${ly}" font-size="${label.fontSize}" font-family="'Noto Sans JP', sans-serif" text-anchor="start" dominant-baseline="central">${escapeXml(label.text)}</text>`
      )
    } else {
      const cx = label.x + label.width / 2
      const cy = label.y + label.height / 2
      parts.push(
        `<text x="${cx}" y="${cy}" font-size="${label.fontSize}" font-family="'Noto Sans JP', sans-serif" text-anchor="middle" dominant-baseline="central">${escapeXml(label.text)}</text>`
      )
    }
  }

  // 模範解答モード: セル内にmodelAnswerテキストを表示
  if (renderMode === "model-answer") {
    for (const cell of layout.cells) {
      if (cell.cellType === "answer" && cell.modelAnswer) {
        const cx = cell.x + cell.width / 2
        const cy = cell.y + cell.height / 2
        parts.push(
          `<text x="${cx}" y="${cy}" font-size="10" font-family="'Noto Sans JP', sans-serif" text-anchor="middle" dominant-baseline="central" fill="#333">${escapeXml(cell.modelAnswer)}</text>`
        )
      }
    }
  }

  // テキスト要素
  for (const cell of layout.cells) {
    if (cell.cellType !== "answer") continue
    for (const te of cell.textElements) {
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
      const extraAttrs = [
        te.fontStyle === "italic" ? ' font-style="italic"' : "",
        te.textDecoration === "line-through"
          ? ' text-decoration="line-through"'
          : "",
      ].join("")
      parts.push(
        `<text x="${tx}" y="${ty}" font-size="${te.fontSize}" font-weight="${te.fontWeight}"${extraAttrs} font-family="'Noto Sans JP', sans-serif" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="#000">${escapeXml(te.text)}</text>`
      )
    }
  }

  // OMRバブル
  for (const cell of layout.cells) {
    parts.push(
      ...renderOMRBubbles(cell, layout.pageWidthMm, layout.pageHeightMm)
    )
  }

  // OMR数字欄
  for (const cell of layout.cells) {
    parts.push(
      ...renderOMRDigitBoxes(cell, layout.pageWidthMm, layout.pageHeightMm)
    )
  }

  // 原稿用紙グリッド
  for (const cell of layout.cells) {
    parts.push(...renderManuscriptGrid(cell))
  }

  parts.push("</svg>")
  return parts.join("\n")
}

/** 単一ページのSVG文字列を生成（ComputedPageLayout版） */
export function renderPageSvgString(
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
    if (
      label.displayMode === "sub-horizontal" ||
      label.displayMode === "branch-horizontal"
    ) {
      const lx = label.x + 1
      const ly = label.y + label.height / 2
      parts.push(
        `<text x="${lx}" y="${ly}" font-size="${label.fontSize}" font-family="'Noto Sans JP', sans-serif" text-anchor="start" dominant-baseline="central">${escapeXml(label.text)}</text>`
      )
    } else {
      const cx = label.x + label.width / 2
      const cy = label.y + label.height / 2
      parts.push(
        `<text x="${cx}" y="${cy}" font-size="${label.fontSize}" font-family="'Noto Sans JP', sans-serif" text-anchor="middle" dominant-baseline="central">${escapeXml(label.text)}</text>`
      )
    }
  }

  if (renderMode === "model-answer") {
    for (const cell of pageLayout.cells) {
      if (cell.cellType === "answer" && cell.modelAnswer) {
        const cx = cell.x + cell.width / 2
        const cy = cell.y + cell.height / 2
        parts.push(
          `<text x="${cx}" y="${cy}" font-size="10" font-family="'Noto Sans JP', sans-serif" text-anchor="middle" dominant-baseline="central" fill="#333">${escapeXml(cell.modelAnswer)}</text>`
        )
      }
    }
  }

  for (const cell of pageLayout.cells) {
    if (cell.cellType !== "answer") continue
    for (const te of cell.textElements) {
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
      const extraAttrs = [
        te.fontStyle === "italic" ? ' font-style="italic"' : "",
        te.textDecoration === "line-through"
          ? ' text-decoration="line-through"'
          : "",
      ].join("")
      parts.push(
        `<text x="${tx}" y="${ty}" font-size="${te.fontSize}" font-weight="${te.fontWeight}"${extraAttrs} font-family="'Noto Sans JP', sans-serif" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="#000">${escapeXml(te.text)}</text>`
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
    // 空円（塗りつぶし前のバブル）
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="black" stroke-width="0.3"/>`
    )
    // ラベルテキスト（バブルの下）
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
