/**
 * 2-in-1 (Nアップ) ユーティリティ
 * 複数ページを1ページに配置
 */
import * as fs from "fs"
import { PDFDocument } from "pdf-lib"

import type { NUpLayout, PageOrder } from "@/types/pdfTools.types"

// A4サイズ (ポイント単位: 1pt = 1/72 inch)
const A4_WIDTH = 595.28 // 210mm
const A4_HEIGHT = 841.89 // 297mm

export interface NUpResult {
  success: boolean
  outputPath?: string
  error?: string
}

/**
 * 2ページを1ページに配置 (2-in-1)
 * A4サイズに収まるようにスケーリング
 */
export async function applyNUp(
  filePath: string,
  layout: NUpLayout,
  order: PageOrder,
  outputPath: string
): Promise<NUpResult> {
  try {
    const fileBuffer = fs.readFileSync(filePath)
    const sourcePdf = await PDFDocument.load(fileBuffer)
    const pageCount = sourcePdf.getPageCount()

    const newPdf = await PDFDocument.create()

    // 出力ページサイズ（A4）
    const outputWidth = A4_WIDTH
    const outputHeight = A4_HEIGHT

    // 2ページずつ処理
    for (let i = 0; i < pageCount; i += 2) {
      const page1Index = i
      const page2Index = i + 1 < pageCount ? i + 1 : null

      // ソースページを取得
      const page1 = sourcePdf.getPage(page1Index)
      const { width: w1, height: h1 } = page1.getSize()

      // 新しいページを作成（A4サイズ）
      const newPage = newPdf.addPage([outputWidth, outputHeight])

      // ページ1を埋め込み
      const [embeddedPage1] = await newPdf.embedPages([page1])

      // ページ2を埋め込み（存在する場合）
      let embeddedPage2 = null
      let w2 = w1
      let h2 = h1
      if (page2Index !== null) {
        const page2 = sourcePdf.getPage(page2Index)
        const size2 = page2.getSize()
        w2 = size2.width
        h2 = size2.height
        const [embedded] = await newPdf.embedPages([page2])
        embeddedPage2 = embedded
      }

      if (layout === "2x1") {
        // 横並び: 各ページを出力ページの半分の幅に収める
        const slotWidth = outputWidth / 2
        const slotHeight = outputHeight

        // 各ページのスケールを計算
        const scale1 = Math.min(slotWidth / w1, slotHeight / h1)
        const scale2 = Math.min(slotWidth / w2, slotHeight / h2)

        // センタリング用オフセット
        const scaledW1 = w1 * scale1
        const scaledH1 = h1 * scale1
        const scaledW2 = w2 * scale2
        const scaledH2 = h2 * scale2

        const offset1X = (slotWidth - scaledW1) / 2
        const offset1Y = (slotHeight - scaledH1) / 2
        const offset2X = (slotWidth - scaledW2) / 2
        const offset2Y = (slotHeight - scaledH2) / 2

        const leftPage = order === "left-right" ? embeddedPage1 : embeddedPage2
        const rightPage = order === "left-right" ? embeddedPage2 : embeddedPage1
        const leftScale = order === "left-right" ? scale1 : scale2
        const rightScale = order === "left-right" ? scale2 : scale1
        const leftOffsetX = order === "left-right" ? offset1X : offset2X
        const leftOffsetY = order === "left-right" ? offset1Y : offset2Y
        const rightOffsetX = order === "left-right" ? offset2X : offset1X
        const rightOffsetY = order === "left-right" ? offset2Y : offset1Y

        if (leftPage) {
          newPage.drawPage(leftPage, {
            x: leftOffsetX,
            y: leftOffsetY,
            xScale: leftScale,
            yScale: leftScale,
          })
        }
        if (rightPage) {
          newPage.drawPage(rightPage, {
            x: slotWidth + rightOffsetX,
            y: rightOffsetY,
            xScale: rightScale,
            yScale: rightScale,
          })
        }
      } else {
        // 縦並び (1x2): 各ページを出力ページの半分の高さに収める
        const slotWidth = outputWidth
        const slotHeight = outputHeight / 2

        // 各ページのスケールを計算
        const scale1 = Math.min(slotWidth / w1, slotHeight / h1)
        const scale2 = Math.min(slotWidth / w2, slotHeight / h2)

        // センタリング用オフセット
        const scaledW1 = w1 * scale1
        const scaledH1 = h1 * scale1
        const scaledW2 = w2 * scale2
        const scaledH2 = h2 * scale2

        const offset1X = (slotWidth - scaledW1) / 2
        const offset1Y = (slotHeight - scaledH1) / 2
        const offset2X = (slotWidth - scaledW2) / 2
        const offset2Y = (slotHeight - scaledH2) / 2

        // 上から順に配置 (left-right = ページ1が上)
        const topPage = order === "left-right" ? embeddedPage1 : embeddedPage2
        const bottomPage =
          order === "left-right" ? embeddedPage2 : embeddedPage1
        const topScale = order === "left-right" ? scale1 : scale2
        const bottomScale = order === "left-right" ? scale2 : scale1
        const topOffsetX = order === "left-right" ? offset1X : offset2X
        const topOffsetY = order === "left-right" ? offset1Y : offset2Y
        const bottomOffsetX = order === "left-right" ? offset2X : offset1X
        const bottomOffsetY = order === "left-right" ? offset2Y : offset1Y

        if (topPage) {
          newPage.drawPage(topPage, {
            x: topOffsetX,
            y: slotHeight + topOffsetY,
            xScale: topScale,
            yScale: topScale,
          })
        }
        if (bottomPage) {
          newPage.drawPage(bottomPage, {
            x: bottomOffsetX,
            y: bottomOffsetY,
            xScale: bottomScale,
            yScale: bottomScale,
          })
        }
      }
    }

    // PDFを保存
    const pdfBytes = await newPdf.save()
    fs.writeFileSync(outputPath, pdfBytes)

    return { success: true, outputPath }
  } catch (error) {
    console.error("N-up error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
