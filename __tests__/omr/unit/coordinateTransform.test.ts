import { describe, expect, it } from "vitest"

import {
  createTransform,
  normalizedRectToPixelRect,
  normalizedToPixel,
} from "../../../electron-src/lib/omr/coordinateTransform"
import type { Point } from "../../../src/types/omr.types"

describe("coordinateTransform", () => {
  // 完全に歪みなしの場合（検出コーナー = 期待コーナー * 画像サイズ）
  const imageWidth = 2480
  const imageHeight = 3508

  // OMRマーカーの0-1正規化中心座標
  // sizeMm=5, offsetMm=3, A4 portrait (210x297mm)
  // TL: (3+2.5)/210, (3+2.5)/297 → 0.02619, 0.01852
  // TR: (210-3-2.5)/210, (3+2.5)/297 → 0.97381, 0.01852
  // BL: (3+2.5)/210, (297-3-2.5)/297 → 0.02619, 0.98148
  // BR: (210-3-2.5)/210, (297-3-2.5)/297 → 0.97381, 0.98148
  const expectedCorners: [Point, Point, Point, Point] = [
    { x: 0.02619, y: 0.01852 },
    { x: 0.97381, y: 0.01852 },
    { x: 0.02619, y: 0.98148 },
    { x: 0.97381, y: 0.98148 },
  ]

  describe("歪みなし（理想的な場合）", () => {
    // 検出コーナー = 正規化座標 * 画像サイズ
    const detectedCorners: [Point, Point, Point, Point] = expectedCorners.map(
      (corner) => ({
        x: corner.x * imageWidth,
        y: corner.y * imageHeight,
      })
    ) as [Point, Point, Point, Point]

    const transform = createTransform(
      detectedCorners,
      expectedCorners,
      imageWidth,
      imageHeight
    )

    it("正規化座標0,0を正しく変換できる", () => {
      const point = normalizedToPixel(0, 0, transform)
      expect(point.x).toBeCloseTo(0, 0)
      expect(point.y).toBeCloseTo(0, 0)
    })

    it("正規化座標1,1を正しく変換できる", () => {
      const point = normalizedToPixel(1, 1, transform)
      expect(point.x).toBeCloseTo(imageWidth, 0)
      expect(point.y).toBeCloseTo(imageHeight, 0)
    })

    it("正規化座標0.5,0.5を正しく変換できる（中心）", () => {
      const point = normalizedToPixel(0.5, 0.5, transform)
      expect(point.x).toBeCloseTo(imageWidth / 2, 0)
      expect(point.y).toBeCloseTo(imageHeight / 2, 0)
    })

    it("任意の正規化座標を誤差2px以内で変換できる", () => {
      const testPoints = [
        { nx: 0.1, ny: 0.1 },
        { nx: 0.3, ny: 0.7 },
        { nx: 0.9, ny: 0.2 },
        { nx: 0.5, ny: 0.95 },
      ]

      for (const { nx, ny } of testPoints) {
        const point = normalizedToPixel(nx, ny, transform)
        const expectedX = nx * imageWidth
        const expectedY = ny * imageHeight
        expect(Math.abs(point.x - expectedX)).toBeLessThan(2)
        expect(Math.abs(point.y - expectedY)).toBeLessThan(2)
      }
    })
  })

  describe("歪みあり（スキャン傾き）", () => {
    // スキャン時に少し回転した場合のシミュレーション
    // 左上が少し右にずれ、右上が少し下にずれた場合
    const skewedCorners: [Point, Point, Point, Point] = [
      { x: 70, y: 60 }, // TL: 少し右にずれ
      { x: 2415, y: 75 }, // TR: 少し下にずれ
      { x: 60, y: 3445 }, // BL: 少し左にずれ
      { x: 2420, y: 3440 }, // BR: 正常
    ]

    const transform = createTransform(
      skewedCorners,
      expectedCorners,
      imageWidth,
      imageHeight
    )

    it("変換結果が検出コーナー付近に収まる", () => {
      // 期待コーナーの正規化座標を変換すると、検出コーナーに近い値になるべき
      for (let i = 0; i < 4; i++) {
        const point = normalizedToPixel(
          expectedCorners[i].x,
          expectedCorners[i].y,
          transform
        )
        expect(Math.abs(point.x - skewedCorners[i].x)).toBeLessThan(2)
        expect(Math.abs(point.y - skewedCorners[i].y)).toBeLessThan(2)
      }
    })

    it("中心付近の座標も妥当な範囲にある", () => {
      const center = normalizedToPixel(0.5, 0.5, transform)
      // 中心は画像中心の近く（歪みにより多少ずれる）
      expect(center.x).toBeGreaterThan(imageWidth * 0.4)
      expect(center.x).toBeLessThan(imageWidth * 0.6)
      expect(center.y).toBeGreaterThan(imageHeight * 0.4)
      expect(center.y).toBeLessThan(imageHeight * 0.6)
    })
  })

  describe("normalizedRectToPixelRect", () => {
    const detectedCorners: [Point, Point, Point, Point] = expectedCorners.map(
      (corner) => ({
        x: corner.x * imageWidth,
        y: corner.y * imageHeight,
      })
    ) as [Point, Point, Point, Point]

    const transform = createTransform(
      detectedCorners,
      expectedCorners,
      imageWidth,
      imageHeight
    )

    it("矩形を正しくピクセル座標に変換できる", () => {
      const rect = normalizedRectToPixelRect(0.1, 0.2, 0.3, 0.15, transform)

      expect(Math.abs(rect.x - imageWidth * 0.1)).toBeLessThan(2)
      expect(Math.abs(rect.y - imageHeight * 0.2)).toBeLessThan(2)
      expect(Math.abs(rect.width - imageWidth * 0.3)).toBeLessThan(4)
      expect(Math.abs(rect.height - imageHeight * 0.15)).toBeLessThan(4)
    })

    it("矩形の幅と高さが正の値を返す", () => {
      const rect = normalizedRectToPixelRect(0.5, 0.5, 0.2, 0.1, transform)
      expect(rect.width).toBeGreaterThan(0)
      expect(rect.height).toBeGreaterThan(0)
    })
  })
})
