import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { detectCornerMarkers } from "../../../electron-src/lib/omr/cornerMarkerDetector"
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

/**
 * 隅ごとの探索範囲（検出器の仕様: 隅から1%の余白、幅30%×高さ8%）。
 * マーカーがこの外へはみ出すと、検出器には範囲の中に入った部分しか見えない
 */
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

/**
 * 4隅すべてが検出され、それぞれが期待の矩形の中心にあることを表明する。
 *
 * 期待の矩形は「マーカーのうち探索範囲に入った部分」に切る。範囲にはみ出した
 * マーカーは、見えている部分の中心で検出される（いまの検出器の挙動）
 */
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
    const visible = intersect(
      rects[marker.corner],
      searchRegion(result.imageWidth, result.imageHeight, marker.corner)
    )
    const expected = centerOf(visible)
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
    // マーカーの上（下）側が探索範囲の外に出る。見えている部分の中心で検出され、
    // 本来の中心から 7px・3.5px 内側へずれる（#1445 の「探索範囲の境界で切られている」）
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

      // 下の2隅は 1% の余白（35px）へ 15px はみ出し、見えている部分の中心で
      // 検出される（本来の中心より 7.5px 上。#1445 の「探索範囲の境界で切られている」）
      expectMarkersAt(result, rects, 0.5)
    })
  })

  describe("罫線が密な解答用紙", () => {
    it("罫線のグリッドに接しない隅は正しい位置で検出し、グリッドに埋もれた TL はずれて信頼度が下がる（#1445）", async () => {
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

      // 水平罫線は TL マーカーを横切るので、TL はグリッドと1つの連結成分になる。
      // いまの検出器はその成分を TL として採り、4隅そろったので success を返す。
      // #1445 で検出器を直したら、この表明（ずれる・success）は書き換える
      expect(result.success).toBe(true)
      const tlMarker = result.markers.find((marker) => marker.corner === "TL")
      expect(tlMarker).toBeDefined()
      const tlCenter = centerOf(rects.TL)
      expect(tlMarker!.centerX - tlCenter.x).toBeGreaterThan(100)
      expect(tlMarker!.centerY - tlCenter.y).toBeGreaterThan(100)
      expect(tlMarker!.confidence).toBeLessThan(0.5)

      // グリッドの無い残り3隅は、マーカーの中心で高い信頼度
      const otherMarkers = result.markers.filter(
        (marker) => marker.corner !== "TL"
      )
      expect(otherMarkers).toHaveLength(3)
      for (const marker of otherMarkers) {
        const expected = centerOf(rects[marker.corner])
        expect(marker.centerX).toBeCloseTo(expected.x, 5)
        expect(marker.centerY).toBeCloseTo(expected.y, 5)
        expect(marker.confidence).toBeGreaterThanOrEqual(0.9)
      }
    })
  })

  describe("罫線がマーカーに接触する最悪ケース", () => {
    it("マーカーの一辺に長い罫線が連結すると、検出されたTLマーカーの中心がずれ、信頼度が低下する", async () => {
      const rects = a4MarkerRects()
      const sheet = blankSheet(A4_WIDTH, A4_HEIGHT)
      paintMarkers(sheet, rects)

      // TLマーカーの右辺に長い水平罫線を連結（マーカー右端から探索領域の右端まで）
      // これによりTLの連結成分は横長になり、正方形スコアが低下する
      const region = searchRegion(A4_WIDTH, A4_HEIGHT, "TL")
      const tlRight = rects.TL.x + rects.TL.w
      paintRect(sheet, {
        x: tlRight,
        y: rects.TL.y + Math.floor(rects.TL.h / 2),
        w: region.w, // 探索領域幅分（範囲の右端で切られる）
        h: 2, // 太さ2px
      })

      const result = await detectCornerMarkers(await savePng(sheet), 128)

      // 探索領域の中で黒い連結成分はマーカー+罫線の1つしか無いので、それが TL として
      // 選ばれる（選び方: 正方形性 × 充填率 × √面積 が最大の成分）。バウンディング
      // ボックスが横長になるので、信頼度（＝縦横比）で異常に気づけることを固定する
      const tlMarker = result.markers.find((marker) => marker.corner === "TL")
      const otherMarkers = result.markers.filter(
        (marker) => marker.corner !== "TL"
      )

      // 他の3マーカーは正常に、高信頼度で検出される
      expect(otherMarkers.map((marker) => marker.corner).sort()).toEqual([
        "BL",
        "BR",
        "TR",
      ])
      for (const marker of otherMarkers) {
        expect(marker.confidence).toBeGreaterThanOrEqual(0.9)
      }

      // TL は検出されるが、中心は「マーカー＋罫線」の外接矩形の中心（探索範囲の右端まで）
      // へずれ、信頼度は正方形のマーカーよりはっきり低い。#1445 で直したら書き換える
      expect(tlMarker).toBeDefined()
      expect(tlMarker!.centerX).toBeCloseTo(
        (rects.TL.x + region.x + region.w) / 2,
        5
      )
      expect(tlMarker!.centerY).toBeCloseTo(centerOf(rects.TL).y, 5)
      expect(tlMarker!.confidence).toBeLessThan(0.5)
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
