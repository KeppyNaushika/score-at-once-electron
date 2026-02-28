/**
 * PDF生成（pdf-lib使用）
 *
 * AnswerSheetDefinition → ComputedLayout → pdf-lib描画 → PDFファイル保存
 */

import fs from "fs"
import path from "path"
import {
  LineCapStyle,
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib"

const fontkit = require("fontkit")

import type {
  AnswerSheetDefinition,
  ComputedPageLayout,
  LineStyle,
} from "../../../types/answerSheetBuilder.types"
import { computeMultiPageLayout } from "./layoutEngine"

/** 1mm = 2.835pt */
const MM_TO_PT = 2.835

function getStrokeDashArray(style: LineStyle): number[] | undefined {
  switch (style) {
    case "dashed":
      return [4, 2]
    case "dotted":
      return [0.01, 3]
    default:
      return undefined
  }
}

function getLineCap(style: LineStyle): LineCapStyle | undefined {
  if (style === "dashed" || style === "dotted") {
    return LineCapStyle.Round
  }
  return undefined
}

export async function generatePdf(
  definition: AnswerSheetDefinition,
  outputPath: string
): Promise<void> {
  const multiLayout = computeMultiPageLayout(definition)
  const pdfDoc = await PDFDocument.create()

  // フォント登録
  pdfDoc.registerFontkit(fontkit)

  // NotoSansJP読込（存在しない場合はHelveticaフォールバック）
  let font: Awaited<ReturnType<typeof pdfDoc.embedFont>>
  const fontPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "NotoSansJP-Regular.ttf"
  )
  if (fs.existsSync(fontPath)) {
    const fontBytes = fs.readFileSync(fontPath)
    font = await pdfDoc.embedFont(fontBytes)
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  }

  const pageWidthPt = multiLayout.pageWidthMm * MM_TO_PT
  const pageHeightPt = multiLayout.pageHeightMm * MM_TO_PT

  // pdf-lib座標: 原点=左下、Y軸上向き → mm座標（原点=左上）からの変換
  const toY = (mmY: number): number => pageHeightPt - mmY * MM_TO_PT

  for (const pageLayout of multiLayout.pages) {
    const page = pdfDoc.addPage([pageWidthPt, pageHeightPt])
    drawPageContent(page, pageLayout, definition, font, toY)
  }

  const pdfBytes = await pdfDoc.save()
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  fs.writeFileSync(outputPath, pdfBytes)
}

function drawPageContent(
  page: PDFPage,
  pageLayout: ComputedPageLayout,
  definition: AnswerSheetDefinition,
  font: PDFFont,
  toY: (mmY: number) => number
): void {
  // OMRマーカー
  for (const marker of pageLayout.omrMarkerPositions) {
    page.drawRectangle({
      x: marker.x * MM_TO_PT,
      y: toY(marker.y + marker.size),
      width: marker.size * MM_TO_PT,
      height: marker.size * MM_TO_PT,
      color: rgb(0, 0, 0),
    })
  }

  // 罫線
  for (const line of pageLayout.lines) {
    const dashArray = getStrokeDashArray(line.style)
    const lineCap = getLineCap(line.style)
    page.drawLine({
      start: { x: line.x1 * MM_TO_PT, y: toY(line.y1) },
      end: { x: line.x2 * MM_TO_PT, y: toY(line.y2) },
      thickness: 0.5,
      color: rgb(0, 0, 0),
      dashArray,
      lineCap,
    })
  }

  // 番号ラベル
  for (const label of pageLayout.numberLabels) {
    const fontSize = Math.min(label.fontSize, label.height * 0.7)
    const textWidth = font.widthOfTextAtSize(label.text, fontSize)

    if (label.displayMode === "sub-horizontal") {
      const lx = (label.x + 1) * MM_TO_PT
      const ly = toY(label.y + label.height / 2) - fontSize / 3
      page.drawText(label.text, {
        x: lx,
        y: ly,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })
    } else {
      const cx = (label.x + label.width / 2) * MM_TO_PT - textWidth / 2
      const cy = toY(label.y + label.height / 2) - fontSize / 3
      page.drawText(label.text, {
        x: cx,
        y: cy,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      })
    }
  }

  // 模範解答テキスト
  if (definition.renderMode === "model-answer") {
    for (const cell of pageLayout.cells) {
      if (cell.cellType === "answer" && cell.modelAnswer) {
        const fontSize = 10
        const textWidth = font.widthOfTextAtSize(cell.modelAnswer, fontSize)
        const cx = (cell.x + cell.width / 2) * MM_TO_PT - textWidth / 2
        const cy = toY(cell.y + cell.height / 2) - fontSize / 3

        page.drawText(cell.modelAnswer, {
          x: cx,
          y: cy,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
        })
      }
    }
  }

  // テキスト要素
  for (const cell of pageLayout.cells) {
    if (cell.cellType !== "answer") continue
    for (const te of cell.textElements) {
      const textWidth = font.widthOfTextAtSize(te.text, te.fontSize)
      let tx: number
      if (te.horizontalAlign === "left") {
        tx = (cell.x + 1) * MM_TO_PT
      } else if (te.horizontalAlign === "right") {
        tx = (cell.x + cell.width - 1) * MM_TO_PT - textWidth
      } else {
        tx = (cell.x + cell.width / 2) * MM_TO_PT - textWidth / 2
      }

      let ty: number
      if (te.verticalAlign === "top") {
        ty = toY(cell.y + te.fontSize * 0.4)
      } else if (te.verticalAlign === "bottom") {
        ty = toY(cell.y + cell.height) + 2
      } else {
        ty = toY(cell.y + cell.height / 2) - te.fontSize / 3
      }

      page.drawText(te.text, {
        x: tx,
        y: ty,
        size: te.fontSize,
        font,
        color: rgb(0, 0, 0),
      })
    }
  }

  // OMRバブル
  {
    const pageWMm = page.getWidth() / MM_TO_PT
    const pageHMm = page.getHeight() / MM_TO_PT
    for (const cell of pageLayout.cells) {
      if (!cell.omrBubbles || cell.omrBubbles.length === 0) continue
      for (const bubble of cell.omrBubbles) {
        const cxMm = bubble.normalizedCx * pageWMm
        const cyMm = bubble.normalizedCy * pageHMm
        const rMm = bubble.normalizedRadius * pageWMm
        page.drawCircle({
          x: cxMm * MM_TO_PT,
          y: toY(cyMm),
          size: rMm * MM_TO_PT,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.3 * MM_TO_PT,
        })
        // ラベルテキスト
        const labelSize = 2.5
        const textWidth = font.widthOfTextAtSize(bubble.label, labelSize)
        page.drawText(bubble.label, {
          x: cxMm * MM_TO_PT - textWidth / 2,
          y: toY(cyMm + rMm + 2),
          size: labelSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
        })
      }
    }

    // OMR数字欄
    for (const cell of pageLayout.cells) {
      if (!cell.omrDigitBoxes || cell.omrDigitBoxes.length === 0) continue
      for (const box of cell.omrDigitBoxes) {
        const bxMm = box.normalizedX * pageWMm
        const byMm = box.normalizedY * pageHMm
        const bwMm = box.normalizedW * pageWMm
        const bhMm = box.normalizedH * pageHMm
        page.drawRectangle({
          x: bxMm * MM_TO_PT,
          y: toY(byMm + bhMm),
          width: bwMm * MM_TO_PT,
          height: bhMm * MM_TO_PT,
          borderColor: rgb(0.4, 0.4, 0.4),
          borderWidth: 0.3 * MM_TO_PT,
        })
      }
    }
  }

  // 原稿用紙グリッド
  const gridColor = rgb(0.8, 0.8, 0.8)
  for (const cell of pageLayout.cells) {
    if (cell.cellType !== "answer" || !cell.manuscriptGrid) continue
    const g = cell.manuscriptGrid
    for (let col = 1; col < g.columns; col++) {
      const x = (g.gridX + col * g.cellSizeMm) * MM_TO_PT
      page.drawLine({
        start: { x, y: toY(g.gridY) },
        end: { x, y: toY(g.gridY + g.gridHeight) },
        thickness: 0.2 * MM_TO_PT,
        color: gridColor,
      })
    }
    for (let row = 1; row < g.rows; row++) {
      const y = toY(g.gridY + row * g.cellSizeMm)
      page.drawLine({
        start: { x: g.gridX * MM_TO_PT, y },
        end: { x: (g.gridX + g.gridWidth) * MM_TO_PT, y },
        thickness: 0.2 * MM_TO_PT,
        color: gridColor,
      })
    }
  }
}
