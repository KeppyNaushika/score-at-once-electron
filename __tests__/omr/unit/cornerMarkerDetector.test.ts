import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import {
  detectCornerMarkers,
  resolveAnswerCorners,
} from "../../../electron-src/lib/omr/cornerMarkerDetector"
import type {
  DetectedCornerMarker,
  MarkerDetectionResult,
} from "../../../src/types/omr.types"

type Corner = DetectedCornerMarker["corner"]

const ALL_CORNERS: Corner[] = ["BL", "BR", "TL", "TR"]
const CHANNELS = 3

/** 画像上の矩形（左上と幅・高さ、px） */
interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** テスト用の答案画像（白背景の RGB） */
interface TestSheet {
  buf: Buffer
  width: number
  height: number
}

/** 書き出した画像の置き場。終わったらまとめて消す */
let workDir: string

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "omr-corner-"))
})

afterAll(() => {
  fs.rmSync(workDir, { recursive: true, force: true })
})

function blankSheet(width: number, height: number): TestSheet {
  return {
    buf: Buffer.alloc(width * height * CHANNELS, 255),
    width,
    height,
  }
}

function paintPixel(sheet: TestSheet, x: number, y: number, gray = 0): void {
  if (x < 0 || x >= sheet.width || y < 0 || y >= sheet.height) return
  const idx = (y * sheet.width + x) * CHANNELS
  sheet.buf[idx] = gray
  sheet.buf[idx + 1] = gray
  sheet.buf[idx + 2] = gray
}

/** 矩形を塗る。gray を関数にすると、矩形内の位置ごとに濃さを変えられる */
function paintRect(
  sheet: TestSheet,
  rect: Rect,
  gray: number | ((dx: number, dy: number) => number) = 0
): void {
  for (let dy = 0; dy < rect.h; dy++) {
    for (let dx = 0; dx < rect.w; dx++) {
      paintPixel(
        sheet,
        rect.x + dx,
        rect.y + dy,
        typeof gray === "number" ? gray : gray(dx, dy)
      )
    }
  }
}

/** 4隅のマーカーの位置（用紙端から markerOffset 離した markerSize 四方） */
function markerRects(
  width: number,
  height: number,
  markerSize: number,
  markerOffset: number,
  shift: { x: number; y: number } = { x: 0, y: 0 }
): Record<Corner, Rect> {
  const near = markerOffset
  const farX = width - markerOffset - markerSize
  const farY = height - markerOffset - markerSize
  const at = (x: number, y: number): Rect => ({
    x: x + shift.x,
    y: y + shift.y,
    w: markerSize,
    h: markerSize,
  })
  return {
    TL: at(near, near),
    TR: at(farX, near),
    BL: at(near, farY),
    BR: at(farX, farY),
  }
}

function paintMarkers(
  sheet: TestSheet,
  rects: Record<Corner, Rect>,
  corners: Corner[] = ALL_CORNERS
): void {
  for (const corner of corners) paintRect(sheet, rects[corner])
}

async function savePng(sheet: TestSheet): Promise<string> {
  const filePath = path.join(workDir, `${crypto.randomUUID()}.png`)
  await sharp(sheet.buf, {
    raw: { width: sheet.width, height: sheet.height, channels: CHANNELS },
  })
    .png()
    .toFile(filePath)
  return filePath
}

/** 隅ごとの探索範囲（検出器の仕様: 隅から1%の余白、幅30%×高さ8%） */
function searchRegion(width: number, height: number, corner: Corner): Rect {
  const marginX = Math.floor(width * 0.01)
  const marginY = Math.floor(height * 0.01)
  const w = Math.floor(width * 0.3)
  const h = Math.floor(height * 0.08)
  return {
    x: corner === "TL" || corner === "BL" ? marginX : width - marginX - w,
    y: corner === "TL" || corner === "TR" ? marginY : height - marginY - h,
    w,
    h,
  }
}

function intersect(first: Rect, second: Rect): Rect {
  const x = Math.max(first.x, second.x)
  const y = Math.max(first.y, second.y)
  return {
    x,
    y,
    w: Math.min(first.x + first.w, second.x + second.w) - x,
    h: Math.min(first.y + first.h, second.y + second.h) - y,
  }
}

function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

/** 4隅すべてが検出され、それぞれが期待の矩形の中心にあることを表明する */
function expectMarkersAt(
  result: MarkerDetectionResult,
  rects: Record<Corner, Rect>,
  tolerance: number
): void {
  expect(result.success).toBe(true)
  expect(result.markers.map((marker) => marker.corner).sort()).toEqual(
    ALL_CORNERS
  )
  for (const marker of result.markers) {
    const expected = centerOf(rects[marker.corner])
    expect(Math.abs(marker.centerX - expected.x)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(marker.centerY - expected.y)).toBeLessThanOrEqual(tolerance)
  }
}

/** A4 300dpi 相当で、5mm のマーカーを端から 3mm に置く（多くのテストの既定） */
const A4_WIDTH = 2480
const A4_HEIGHT = 3508
const MARKER_SIZE_5MM = 59
const MARKER_OFFSET_3MM = 35

function a4MarkerRects(): Record<Corner, Rect> {
  return markerRects(A4_WIDTH, A4_HEIGHT, MARKER_SIZE_5MM, MARKER_OFFSET_3MM)
}

describe("cornerMarkerDetector", () => {
  it("4隅のマーカーを全て検出できる", async () => {
    const width = 2480 // A4 300dpi相当
    const height = 3508
    const rects = markerRects(width, height, 40, 25) // ~3.4mm を ~2.1mm に
    const sheet = blankSheet(width, height)
    paintMarkers(sheet, rects)

    const result = await detectCornerMarkers(await savePng(sheet), 128)

    expect(result.success).toBe(true)
    expect(result.markers).toHaveLength(4)
    expect(result.imageWidth).toBe(width)
    expect(result.imageHeight).toBe(height)

    // 各コーナーが検出されている
    const corners = result.markers.map((marker) => marker.corner).sort()
    expect(corners).toEqual(ALL_CORNERS)
  })

  it("検出座標がマーカー中心付近にある（誤差5px以内）", async () => {
    const rects = markerRects(2480, 3508, 40, 25)
    const sheet = blankSheet(2480, 3508)
    paintMarkers(sheet, rects)

    const result = await detectCornerMarkers(await savePng(sheet), 128)

    expectMarkersAt(result, rects, 5)
  })

  it("マーカーが不足している場合はsuccess=falseを返す", async () => {
    const sheet = blankSheet(2480, 3508)
    // 3隅のみマーカーを描画（BRなし）
    paintMarkers(sheet, markerRects(2480, 3508, 40, 25), ["TL", "TR", "BL"])

    const result = await detectCornerMarkers(await savePng(sheet), 128)

    expect(result.success).toBe(false)
    expect(result.markers.map((marker) => marker.corner).sort()).toEqual([
      "BL",
      "TL",
      "TR",
    ])
    expect(result.error).toMatch(/3\/4 のマーカーのみ検出されました/)
  })

  it("信頼度が正方形マーカーに対して高い値を返す", async () => {
    const sheet = blankSheet(2480, 3508)
    paintMarkers(sheet, markerRects(2480, 3508, 40, 25))

    const result = await detectCornerMarkers(await savePng(sheet), 128)

    expect(result.success).toBe(true)
    expect(result.markers).toHaveLength(4)
    for (const marker of result.markers) {
      expect(marker.confidence).toBeGreaterThanOrEqual(0.75)
    }
  })

  it("小さい画像でも検出できる", async () => {
    // 端から 10px は 1% の余白（上下 11px）より内側なので、上端の 1px が範囲外に出る
    const rects = markerRects(800, 1100, 15, 10)
    const sheet = blankSheet(800, 1100)
    paintMarkers(sheet, rects)

    const result = await detectCornerMarkers(await savePng(sheet), 128)

    expectMarkersAt(result, rects, 0.5)
  })

  it("罫線が探索領域内にあってもマーカーを正しく検出できる", async () => {
    const rects = a4MarkerRects()
    const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
    paintMarkers(sheet, rects)

    // 罫線を描画（幅2px、探索領域に入る位置に水平・垂直線を配置。マーカーには接しない）
    // 上端から100px: 水平罫線（探索領域の高さ8%=280px内）
    paintRect(sheet, { x: 0, y: 100, w: A4_WIDTH, h: 2 })
    // 左端から100px: 垂直罫線（探索領域の幅30%=744px内）
    paintRect(sheet, { x: 100, y: 0, w: 2, h: A4_HEIGHT })

    const result = await detectCornerMarkers(await savePng(sheet), 128)

    expectMarkersAt(result, rects, 0.5)
  })

  // =========================================================================
  // 追加テスト: 包括的なコーナーマーカー検出テスト
  // =========================================================================

  describe("複数用紙サイズ対応", () => {
    // A3・B4 は 1% の余白（上下 49px・42px）が端からの距離 35px より大きく、
    // マーカーの上（下）側が最初の探索範囲の外に出る。切れていることに気づいて
    // 余白を外して探し直すので、本来の中心で検出される（#1445）
    it.each([
      { name: "A4", width: 2480, height: 3508 },
      { name: "A3", width: 3508, height: 4961 },
      { name: "B4", width: 3035, height: 4299 },
      { name: "B5", width: 2150, height: 3035 },
      { name: "A4横", width: 3508, height: 2480 },
    ])(
      "$name ($width×$height) で4隅マーカーを検出できる",
      async ({ width, height }) => {
        const rects = markerRects(
          width,
          height,
          MARKER_SIZE_5MM,
          MARKER_OFFSET_3MM
        )
        const sheet = blankSheet(width, height)
        paintMarkers(sheet, rects)

        const result = await detectCornerMarkers(await savePng(sheet), 128)

        expect(result.imageWidth).toBe(width)
        expect(result.imageHeight).toBe(height)
        expectMarkersAt(result, rects, 0.5)
      }
    )
  })

  describe("プリンターの印刷マージン対応", () => {
    it("用紙端5mm切り取りでもマーカーを検出できる（最大40%欠損）", async () => {
      const rects = a4MarkerRects()
      const printMargin = 59 // 5mm @ 300dpi
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
      paintMarkers(sheet, rects)

      // 用紙端5mm（59px）を白で塗りつぶし（プリンターマージンのシミュレーション）
      paintRect(sheet, { x: 0, y: 0, w: A4_WIDTH, h: printMargin }, 255)
      paintRect(
        sheet,
        { x: 0, y: A4_HEIGHT - printMargin, w: A4_WIDTH, h: printMargin },
        255
      )
      paintRect(sheet, { x: 0, y: 0, w: printMargin, h: A4_HEIGHT }, 255)
      paintRect(
        sheet,
        { x: A4_WIDTH - printMargin, y: 0, w: printMargin, h: A4_HEIGHT },
        255
      )

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      // 印刷された部分（用紙端から 59px より内側）の中心で検出される。本来の中心から
      // 12px 内側だが、模範解答も同じプリンターで欠けるので位置合わせは崩れない
      const printable: Rect = {
        x: printMargin,
        y: printMargin,
        w: A4_WIDTH - printMargin * 2,
        h: A4_HEIGHT - printMargin * 2,
      }
      const printedRects: Record<Corner, Rect> = {
        TL: intersect(rects.TL, printable),
        TR: intersect(rects.TR, printable),
        BL: intersect(rects.BL, printable),
        BR: intersect(rects.BR, printable),
      }
      expectMarkersAt(result, printedRects, 0.5)
    })
  })

  describe("スキャナーノイズ耐性", () => {
    it("ランダムノイズ（0.5%密度）があっても4マーカーを検出できる", async () => {
      const rects = a4MarkerRects()
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
      paintMarkers(sheet, rects)

      // 擬似ランダムノイズを散布（再現性のあるシード的ループ）
      // 画像全体の約0.5%密度 = width*height*0.005 個の点
      const noiseCount = Math.floor(A4_WIDTH * A4_HEIGHT * 0.005)
      for (let i = 0; i < noiseCount; i++) {
        // 1-3pxの点を描画
        const dotSize = 1 + (i % 3)
        paintRect(sheet, {
          x: (i * 7919) % A4_WIDTH,
          y: (i * 7907) % A4_HEIGHT,
          w: dotSize,
          h: dotSize,
        })
      }

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      // マーカーに接した点の分だけ外接矩形が膨らむので、数 px までは許す
      expectMarkersAt(result, rects, 2)
    })
  })

  describe("答案のズレ（傾き/オフセット）", () => {
    it("マーカーが右に10px、下に15pxずれても検出できる", async () => {
      const rects = markerRects(
        A4_WIDTH,
        A4_HEIGHT,
        MARKER_SIZE_5MM,
        MARKER_OFFSET_3MM,
        { x: 10, y: 15 }
      )
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
      paintMarkers(sheet, rects)

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      // 下の2隅は 1% の余白（35px）へ 15px はみ出すが、余白を外して探し直すので
      // 本来の中心で検出される（#1445）
      expectMarkersAt(result, rects, 0.5)
    })
  })

  describe("罫線が密な解答用紙", () => {
    it("罫線のグリッドに埋もれた TL も、細い線を剥がしてマーカーの中心で検出する（#1445）", async () => {
      const rects = a4MarkerRects()
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
      paintMarkers(sheet, rects)

      const region = searchRegion(A4_WIDTH, A4_HEIGHT, "TL")

      // 水平罫線グリッド（上側探索領域内、20px間隔、太さ1-2px）
      for (let lineY = region.y + 5; lineY < region.y + region.h; lineY += 20) {
        const thickness = lineY % 40 < 20 ? 1 : 2
        paintRect(sheet, { x: region.x, y: lineY, w: region.w, h: thickness })
      }

      // 垂直罫線グリッド（探索領域内、30px間隔、太さ1px）
      for (let lineX = region.x + 5; lineX < region.x + region.w; lineX += 30) {
        paintRect(sheet, { x: lineX, y: region.y, w: 1, h: region.h })
      }

      // マーカーに1px隣接する罫線を追加（TLマーカーの右辺に接触）
      paintRect(sheet, {
        x: rects.TL.x + rects.TL.w,
        y: rects.TL.y,
        w: 1,
        h: rects.TL.h,
      })

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      // マーカーの外へ出た罫線は剥がれるが、マーカーの右辺に接した 1px の線は
      // マーカーの縁として残るので、その分（0.5px）だけ右へ寄る
      expectMarkersAt(result, rects, 0.5)
      for (const marker of result.markers) {
        expect(marker.confidence).toBeGreaterThanOrEqual(0.9)
      }
    })
  })

  describe("罫線がマーカーに接触する場合（#1445）", () => {
    it("マーカーの一辺に細い罫線が連結しても、線を剥がしてマーカーの中心で検出する", async () => {
      const rects = a4MarkerRects()
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
      paintMarkers(sheet, rects)

      // TLマーカーの右辺に長い水平罫線を連結（マーカー右端から探索領域の右端の先まで）
      const region = searchRegion(A4_WIDTH, A4_HEIGHT, "TL")
      paintRect(sheet, {
        x: rects.TL.x + rects.TL.w,
        y: rects.TL.y + Math.floor(rects.TL.h / 2),
        w: region.w,
        h: 2,
      })

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      expectMarkersAt(result, rects, 0.5)
      for (const marker of result.markers) {
        expect(marker.confidence).toBeGreaterThanOrEqual(0.9)
      }
    })

    it("剥がせない太い枠線がマーカーに重なると、その隅は失敗にする（ずれた位置を返さない）", async () => {
      const rects = a4MarkerRects()
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
      paintMarkers(sheet, rects)

      // 太さ 1mm（12px）の枠線が TL マーカーの下半分に重なって右へ伸びる
      const region = searchRegion(A4_WIDTH, A4_HEIGHT, "TL")
      paintRect(sheet, {
        x: rects.TL.x,
        y: rects.TL.y + rects.TL.h - 12,
        w: region.w,
        h: 12,
      })

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      expect(result.success).toBe(false)
      expect(result.markers.map((marker) => marker.corner).sort()).toEqual([
        "BL",
        "BR",
        "TR",
      ])
      const tlDiagnostics = result.diagnostics?.find(
        (diagnostic) => diagnostic.corner === "TL"
      )
      expect(tlDiagnostics?.detected).toBe(false)
      expect(result.error).toMatch(/TL: /)
    })
  })

  describe("探索範囲や画像の端で切れたマーカー（#1445）", () => {
    it("画像の端で切れたマーカーは、見えている部分の中心を返さず失敗にする", async () => {
      // TL だけ用紙の外へ 20px はみ出している（スキャンでトリミングされた）
      const rects = a4MarkerRects()
      rects.TL = { ...rects.TL, x: -20 }
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
      paintMarkers(sheet, rects)

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      expect(result.success).toBe(false)
      expect(result.markers.map((marker) => marker.corner).sort()).toEqual([
        "BL",
        "BR",
        "TR",
      ])
      expect(result.error).toMatch(/TL: マーカーが画像の端で切れています/)
    })
  })

  describe("マーカーサイズのバリエーション", () => {
    it.each([
      { name: "3mm", markerSize: 35 },
      { name: "5mm", markerSize: 59 },
      { name: "7mm", markerSize: 83 },
      { name: "10mm", markerSize: 118 },
    ])(
      "マーカーサイズ $name ($markerSize px) で検出できる",
      async ({ markerSize }) => {
        const rects = markerRects(
          A4_WIDTH,
          A4_HEIGHT,
          markerSize,
          MARKER_OFFSET_3MM
        )
        const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
        paintMarkers(sheet, rects)

        const result = await detectCornerMarkers(await savePng(sheet), 128)

        expectMarkersAt(result, rects, 0.5)
      }
    )
  })

  describe("グレースケール近似（アンチエイリアス）", () => {
    it("辺2pxがグレー（R=80）、内部が黒（R=0）でも検出できる", async () => {
      const rects = a4MarkerRects()
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)

      // 4隅にアンチエイリアス付きマーカーを描画
      for (const corner of ALL_CORNERS) {
        const rect = rects[corner]
        paintRect(sheet, rect, (dx, dy) => {
          // 辺から2px以内はグレー（R=80）、それ以外は黒（R=0）
          const distFromEdge = Math.min(
            dx,
            dy,
            rect.w - 1 - dx,
            rect.h - 1 - dy
          )
          return distFromEdge < 2 ? 80 : 0
        })
      }

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      expectMarkersAt(result, rects, 0.5)
    })
  })
})

describe("resolveAnswerCorners", () => {
  /** 模範解答の4隅（ピクセル） */
  const reference: Record<Corner, { x: number; y: number }> = {
    TL: { x: 100, y: 100 },
    TR: { x: 2380, y: 100 },
    BL: { x: 100, y: 3408 },
    BR: { x: 2380, y: 3408 },
  }

  /** 答案: 模範解答を 2° 回し、0.98 倍して (30, -12) ずらした4隅 */
  function transformed(point: { x: number; y: number }) {
    const angle = (2 * Math.PI) / 180
    const scale = 0.98
    return {
      x: scale * (Math.cos(angle) * point.x - Math.sin(angle) * point.y) + 30,
      y: scale * (Math.sin(angle) * point.x + Math.cos(angle) * point.y) - 12,
    }
  }

  function detectionOf(corners: Corner[]): MarkerDetectionResult {
    return {
      success: corners.length === 4,
      markers: corners.map((corner) => ({
        centerX: transformed(reference[corner]).x,
        centerY: transformed(reference[corner]).y,
        size: 59,
        corner,
        confidence: 1,
      })),
      imageWidth: A4_WIDTH,
      imageHeight: A4_HEIGHT,
    }
  }

  it("4隅とも検出できていれば、そのまま [TL, TR, BL, BR] の順に返す", () => {
    const resolved = resolveAnswerCorners(
      detectionOf(["BR", "TL", "BL", "TR"]),
      reference
    )
    expect(resolved?.estimatedCorner).toBeNull()
    expect(resolved?.corners).toEqual([
      transformed(reference.TL),
      transformed(reference.TR),
      transformed(reference.BL),
      transformed(reference.BR),
    ])
  })

  it.each(ALL_CORNERS)(
    "%s が欠けていれば、残り3隅と模範解答の対応から推定する",
    (missing) => {
      const resolved = resolveAnswerCorners(
        detectionOf(ALL_CORNERS.filter((corner) => corner !== missing)),
        reference
      )
      expect(resolved?.estimatedCorner).toBe(missing)
      const index = ["TL", "TR", "BL", "BR"].indexOf(missing)
      const expected = transformed(reference[missing])
      expect(resolved!.corners[index].x).toBeCloseTo(expected.x, 6)
      expect(resolved!.corners[index].y).toBeCloseTo(expected.y, 6)
    }
  )

  it("基準が正規化座標でも、縮尺の違いを吸収して推定する", () => {
    const normalized = Object.fromEntries(
      ALL_CORNERS.map((corner) => [
        corner,
        {
          x: reference[corner].x / A4_WIDTH,
          y: reference[corner].y / A4_HEIGHT,
        },
      ])
    ) as Record<Corner, { x: number; y: number }>
    const resolved = resolveAnswerCorners(
      detectionOf(["TL", "TR", "BL"]),
      normalized
    )
    const expected = transformed(reference.BR)
    expect(resolved!.corners[3].x).toBeCloseTo(expected.x, 6)
    expect(resolved!.corners[3].y).toBeCloseTo(expected.y, 6)
  })

  it("2隅以上欠けていれば null（位置を合わせられない）", () => {
    expect(
      resolveAnswerCorners(detectionOf(["TL", "BR"]), reference)
    ).toBeNull()
  })
})
