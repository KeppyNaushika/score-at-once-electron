/**
 * SVG文字列生成（サーバーサイド）
 *
 * ComputedLayoutからSVG文字列を生成する。
 * PNG生成時にsharpでラスタライズする際に使用。
 */

import type {
  ComputedLayout,
  ComputedLine,
  LineStyle,
  RenderMode,
} from "../../../types/answerSheetBuilder.types"

/** mm → SVGのpx変換（出力DPIに応じて外部でスケーリング） */
const MM_SCALE = 1

function lineStyleToSvg(style: LineStyle): string {
  switch (style) {
    case "dashed":
      return 'stroke-dasharray="4 2"'
    case "dotted":
      return 'stroke-dasharray="1 2"'
    default:
      return ""
  }
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
    if (label.displayMode === "sub-horizontal") {
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
      parts.push(
        `<text x="${tx}" y="${ty}" font-size="${te.fontSize}" font-weight="${te.fontWeight}" font-family="'Noto Sans JP', sans-serif" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="#000">${escapeXml(te.text)}</text>`
      )
    }
  }

  parts.push("</svg>")
  return parts.join("\n")
}

function renderLine(line: ComputedLine): string {
  const dashAttr = lineStyleToSvg(line.style)
  return `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="black" stroke-width="0.5" ${dashAttr}/>`
}
