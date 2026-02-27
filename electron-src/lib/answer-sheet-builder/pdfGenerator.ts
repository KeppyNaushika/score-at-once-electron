/**
 * PDF生成（pdf-lib使用）
 *
 * AnswerSheetDefinition → ComputedLayout → pdf-lib描画 → PDFファイル保存
 */

import fs from "fs"
import path from "path"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

const fontkit = require("fontkit")

import type {
  AnswerSheetDefinition,
  LineStyle,
} from "../../../types/answerSheetBuilder.types"
import { computeLayout } from "./layoutEngine"

/** 1mm = 2.835pt */
const MM_TO_PT = 2.835

function getStrokeDashArray(style: LineStyle): number[] | undefined {
  switch (style) {
    case "dashed":
      return [4, 2]
    case "dotted":
      return [1, 2]
    default:
      return undefined
  }
}

export async function generatePdf(
  definition: AnswerSheetDefinition,
  outputPath: string
): Promise<void> {
  const layout = computeLayout(definition)
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

  const pageWidthPt = layout.pageWidthMm * MM_TO_PT
  const pageHeightPt = layout.pageHeightMm * MM_TO_PT

  const page = pdfDoc.addPage([pageWidthPt, pageHeightPt])

  // pdf-lib座標: 原点=左下、Y軸上向き → mm座標（原点=左上）からの変換
  const toY = (mmY: number): number => pageHeightPt - mmY * MM_TO_PT

  // OMRマーカー
  for (const marker of layout.omrMarkerPositions) {
    page.drawRectangle({
      x: marker.x * MM_TO_PT,
      y: toY(marker.y + marker.size),
      width: marker.size * MM_TO_PT,
      height: marker.size * MM_TO_PT,
      color: rgb(0, 0, 0),
    })
  }

  // 罫線
  for (const line of layout.lines) {
    const dashArray = getStrokeDashArray(line.style)
    page.drawLine({
      start: { x: line.x1 * MM_TO_PT, y: toY(line.y1) },
      end: { x: line.x2 * MM_TO_PT, y: toY(line.y2) },
      thickness: 0.5,
      color: rgb(0, 0, 0),
      dashArray,
    })
  }

  // 番号ラベル
  for (const label of layout.numberLabels) {
    const fontSize = Math.min(label.fontSize, label.height * 0.7)
    const textWidth = font.widthOfTextAtSize(label.text, fontSize)

    if (label.displayMode === "sub-horizontal") {
      // 横配置時の小問ラベル: 左寄せ + 垂直中央
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
      // その他: 中央配置
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
    for (const cell of layout.cells) {
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
  for (const cell of layout.cells) {
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

  const pdfBytes = await pdfDoc.save()
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  fs.writeFileSync(outputPath, pdfBytes)
}
