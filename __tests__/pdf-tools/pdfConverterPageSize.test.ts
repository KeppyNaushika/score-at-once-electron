/**
 * PDF のページを画像にするときの canvas の上限（`src/lib/pdfConverter.ts` の
 * `oversizedPdfPageReason`）を縛る。
 *
 * - 倍率 2.0 で A0 までのページは通す
 * - 辺の長さ・面積のどちらかが上限を超えるページは、ページ番号を含む理由を返す
 */
import { describe, expect, it } from "vitest"

import {
  MAX_PDF_CANVAS_AREA,
  MAX_PDF_CANVAS_SIDE,
  oversizedPdfPageReason,
  PDF_RENDER_SCALE,
} from "../../src/lib/pdfConverter"

/** A0・A4 の寸法（ポイント） */
const A0_POINTS = { width: 2384, height: 3370 }
const A4_POINTS = { width: 595, height: 842 }

describe("oversizedPdfPageReason: 収まるページ", () => {
  it.each([
    ["A4", A4_POINTS],
    ["A0", A0_POINTS],
  ])("%s は倍率 2.0 で通す", (_paperName, paperPoints) => {
    expect(
      oversizedPdfPageReason(
        1,
        paperPoints.width * PDF_RENDER_SCALE,
        paperPoints.height * PDF_RENDER_SCALE
      )
    ).toBeNull()
  })
})

describe("oversizedPdfPageReason: 上限を超えるページ", () => {
  it("辺の長さが上限を超えると理由を返す", () => {
    const reason = oversizedPdfPageReason(3, MAX_PDF_CANVAS_SIDE + 1, 10)
    expect(reason).not.toBeNull()
    expect(reason).toContain("3ページ目")
  })

  it("辺は上限内でも面積が上限を超えると理由を返す", () => {
    const side = Math.ceil(Math.sqrt(MAX_PDF_CANVAS_AREA)) + 1
    expect(side).toBeLessThanOrEqual(MAX_PDF_CANVAS_SIDE)
    expect(oversizedPdfPageReason(1, side, side)).not.toBeNull()
  })

  it("PDF の上限の大きさ（約 14400 インチ角）のページは断る", () => {
    const maximumPagePoints = 14400 * 72
    expect(
      oversizedPdfPageReason(
        1,
        maximumPagePoints * PDF_RENDER_SCALE,
        maximumPagePoints * PDF_RENDER_SCALE
      )
    ).not.toBeNull()
  })
})
