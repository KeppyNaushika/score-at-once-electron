/**
 * 答案に重ねる要素の長さ（lengthUnit）の換算
 *
 * 画素で持っていた行（"px"）を mm へ変換したとき、代表の答案画像に描かれる画素が変換の前後で
 * 一致すること。用紙サイズのラベルが実際の画像と食い違う試験でも一致すること。
 */

import { describe, expect, it } from "vitest"

import {
  convertPixelLengthsToMm,
  FALLBACK_PIXELS_PER_MM,
  overlayPixelsPerMm,
  resolveAnchorPoint,
  resolveImageOrigin,
  resolveOverlayPixelLengths,
} from "@/lib/answerOverlayPlacement"
import type {
  AnswerOverlayStyle,
  OverlayAnchor,
  OverlayKind,
} from "@/types/scoringOverlay.types"
import {
  DEFAULT_ANSWER_OVERLAY_SETTINGS,
  OVERLAY_ANCHORS,
} from "@/types/scoringOverlay.types"

const REGION = { x: 412.5, y: 300.25, width: 233.7, height: 118.4 }

/** 1行を描いたときの画素（画像なら左上と一辺、文字ならアンカー点とフォントの大きさ） */
function drawnPixels(
  style: AnswerOverlayStyle,
  pixelsPerMm: number
): { x: number; y: number; size: number } {
  const lengths = resolveOverlayPixelLengths(style, pixelsPerMm)
  const isImage = style.overlayKind === "mark"
  const anchorPoint = resolveAnchorPoint(
    REGION,
    style.position,
    lengths.offsetX,
    lengths.offsetY,
    isImage ? lengths.imageEdgePadding : 0
  )
  const point = isImage
    ? resolveImageOrigin(anchorPoint, style.anchor, lengths.size)
    : anchorPoint
  return { ...point, size: lengths.size }
}

function pixelStyle(
  overlayKind: OverlayKind,
  position: OverlayAnchor,
  lengths: { size: number; offsetX: number; offsetY: number }
): AnswerOverlayStyle {
  return {
    ...DEFAULT_ANSWER_OVERLAY_SETTINGS.styles[overlayKind],
    position,
    anchor: position,
    lengthUnit: "px",
    ...lengths,
  }
}

function expectSamePixels(
  before: { x: number; y: number; size: number },
  after: { x: number; y: number; size: number }
): void {
  expect(after.x).toBeCloseTo(before.x, 9)
  expect(after.y).toBeCloseTo(before.y, 9)
  expect(after.size).toBeCloseTo(before.size, 9)
}

/** "px" の行を mm へ変換し、同じ画像に描いた画素が変わらないことを確かめる */
function expectConversionKeepsPixels(
  pageSize: string,
  imageWidth: number,
  imageHeight: number
): void {
  const pixelsPerMm = overlayPixelsPerMm(pageSize, imageWidth, imageHeight)
  for (const overlayKind of ["mark", "partial", "subtotal", "total"] as const) {
    for (const position of OVERLAY_ANCHORS) {
      const before = pixelStyle(overlayKind, position, {
        size: overlayKind === "mark" ? 50 : 14,
        offsetX: -7,
        offsetY: 12,
      })
      const after: AnswerOverlayStyle = {
        ...before,
        lengthUnit: "mm",
        ...convertPixelLengthsToMm(before, pixelsPerMm),
      }
      expectSamePixels(
        drawnPixels(before, pixelsPerMm),
        drawnPixels(after, pixelsPerMm)
      )
    }
  }
}

describe("resolveOverlayPixelLengths", () => {
  it("px の行は画素のまま描き、旧来の余白 5px を使う", () => {
    const style = pixelStyle("mark", "top-left", {
      size: 50,
      offsetX: 3,
      offsetY: -4,
    })
    expect(resolveOverlayPixelLengths(style, 10)).toEqual({
      size: 50,
      offsetX: 3,
      offsetY: -4,
      imageEdgePadding: 5,
    })
  })

  it("mm の行は 1mm あたりの画素数を掛けて描き、隠れた余白は持たない", () => {
    const style: AnswerOverlayStyle = {
      ...DEFAULT_ANSWER_OVERLAY_SETTINGS.styles.mark,
      size: 9,
      offsetX: 2,
      offsetY: -1.5,
    }
    expect(resolveOverlayPixelLengths(style, 10)).toEqual({
      size: 90,
      offsetX: 20,
      offsetY: -15,
      imageEdgePadding: 0,
    })
  })

  it("1mm あたりの画素数は注釈と同じく、画像の幅 ÷ 向きを考慮した用紙の幅", () => {
    expect(overlayPixelsPerMm("A4", 1191, 1684)).toBeCloseTo(1191 / 210, 12)
    expect(overlayPixelsPerMm("A4", 1684, 1191)).toBeCloseTo(1684 / 297, 12)
    expect(overlayPixelsPerMm("A3", 1684, 2381)).toBeCloseTo(1684 / 297, 12)
  })
})

describe("convertPixelLengthsToMm（描画の式のちょうど逆）", () => {
  it("A4 縦・144dpi の答案で、変換の前後に描く画素が一致する", () => {
    expectConversionKeepsPixels("A4", 1191, 1684)
  })

  it("A4 横・144dpi の答案で、変換の前後に描く画素が一致する", () => {
    expectConversionKeepsPixels("A4", 1684, 1191)
  })

  it("A4 縦・300dpi の答案で、変換の前後に描く画素が一致する", () => {
    expectConversionKeepsPixels("A4", 2480, 3508)
  })

  it("ラベルは A4 なのに実際は A3 の画像でも、変換の前後に描く画素が一致する", () => {
    // A3 を 144dpi で読んだ画像（1684×2381）に A4 のラベル
    expectConversionKeepsPixels("A4", 1684, 2381)
    // A3 横・300dpi
    expectConversionKeepsPixels("A4", 4961, 3508)
  })

  it("ラベルが B4 で画像が A4 300dpi でも一致する", () => {
    expectConversionKeepsPixels("B4", 2480, 3508)
  })

  it("答案の無い試験の代用（144dpi 相当）で変換した値", () => {
    const converted = convertPixelLengthsToMm(
      {
        overlayKind: "partial",
        position: "middle-center",
        size: 14,
        offsetX: 0,
        offsetY: 0,
      },
      FALLBACK_PIXELS_PER_MM
    )
    expect(converted.size).toBeCloseTo((14 * 25.4) / 144, 12)
    expect(converted.offsetX).toBe(0)
  })

  it("採点マークの端寄せでは旧来の余白を offset に含める（文字には余白が無いので含めない）", () => {
    const pixelsPerMm = 10
    const mark = convertPixelLengthsToMm(
      {
        overlayKind: "mark",
        position: "bottom-right",
        size: 50,
        offsetX: 0,
        offsetY: 0,
      },
      pixelsPerMm
    )
    // 右下: 旧来の余白は内側（-）へ 5px。mm の行は余白を持たないので offset -5px(-0.5mm) で表す
    expect(mark.offsetX).toBeCloseTo(-0.5, 12)
    expect(mark.offsetY).toBeCloseTo(-0.5, 12)

    const text = convertPixelLengthsToMm(
      {
        overlayKind: "total",
        position: "bottom-right",
        size: 18,
        offsetX: 0,
        offsetY: 0,
      },
      pixelsPerMm
    )
    expect(text.offsetX).toBe(0)
    expect(text.offsetY).toBe(0)
  })
})

describe("既定値", () => {
  it("新しい行の既定は mm", () => {
    for (const style of Object.values(DEFAULT_ANSWER_OVERLAY_SETTINGS.styles)) {
      expect(style.lengthUnit).toBe("mm")
    }
  })
})
