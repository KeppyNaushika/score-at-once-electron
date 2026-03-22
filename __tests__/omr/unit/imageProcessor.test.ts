/**
 * 画像処理ユーティリティ テスト
 *
 * computeCircularFillRatio / computeEllipticalFillRatio の
 * 塗りつぶし判定を検証する。
 */

import { describe, expect, it } from "vitest"

import {
  computeCircularFillRatio,
  computeEllipticalFillRatio,
} from "../../../electron-src/lib/omr/imageProcessor"
import type { RawImageData } from "../../../src/types/omr.types"

/** 白背景のRawImageDataを作成 */
function createWhiteImage(width: number, height: number): RawImageData {
  const channels = 3
  const data = Buffer.alloc(width * height * channels, 255)
  return { data, width, height, channels }
}

/** 楕円領域を黒く塗った画像を作成 */
function createImageWithFilledEllipse(
  imgWidth: number,
  imgHeight: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number
): RawImageData {
  const channels = 3
  const data = Buffer.alloc(imgWidth * imgHeight * channels, 255)

  for (let py = 0; py < imgHeight; py++) {
    for (let px = 0; px < imgWidth; px++) {
      const dx = (px - cx) / halfW
      const dy = (py - cy) / halfH
      if (dx * dx + dy * dy <= 1) {
        const idx = (py * imgWidth + px) * channels
        data[idx] = 0 // R
        data[idx + 1] = 0 // G
        data[idx + 2] = 0 // B
      }
    }
  }

  return { data, width: imgWidth, height: imgHeight, channels }
}

/** 円領域を黒く塗った画像を作成 */
function createImageWithFilledCircle(
  imgWidth: number,
  imgHeight: number,
  cx: number,
  cy: number,
  radius: number
): RawImageData {
  return createImageWithFilledEllipse(
    imgWidth,
    imgHeight,
    cx,
    cy,
    radius,
    radius
  )
}

describe("computeCircularFillRatio", () => {
  it("完全に白い画像では塗りつぶし率が0", () => {
    const img = createWhiteImage(100, 100)
    const ratio = computeCircularFillRatio(img, 50, 50, 20, 128)
    expect(ratio).toBe(0)
  })

  it("円を完全に塗りつぶした画像では塗りつぶし率が1に近い", () => {
    const img = createImageWithFilledCircle(200, 200, 100, 100, 30)
    const ratio = computeCircularFillRatio(img, 100, 100, 30, 128)
    expect(ratio).toBeGreaterThan(0.95)
  })

  it("半分だけ塗った場合は0.5付近", () => {
    const imgWidth = 200
    const imgHeight = 200
    const channels = 3
    const data = Buffer.alloc(imgWidth * imgHeight * channels, 255)

    // 円の上半分だけ黒く塗る
    const cx = 100
    const cy = 100
    const radius = 30
    for (let py = 0; py < imgHeight; py++) {
      for (let px = 0; px < imgWidth; px++) {
        const dx = px - cx
        const dy = py - cy
        if (dx * dx + dy * dy <= radius * radius && py <= cy) {
          const idx = (py * imgWidth + px) * channels
          data[idx] = 0
          data[idx + 1] = 0
          data[idx + 2] = 0
        }
      }
    }
    const img: RawImageData = {
      data,
      width: imgWidth,
      height: imgHeight,
      channels,
    }

    const ratio = computeCircularFillRatio(img, cx, cy, radius, 128)
    expect(ratio).toBeGreaterThan(0.4)
    expect(ratio).toBeLessThan(0.6)
  })
})

describe("computeEllipticalFillRatio", () => {
  it("完全に白い画像では塗りつぶし率が0", () => {
    const img = createWhiteImage(200, 200)
    const ratio = computeEllipticalFillRatio(img, 100, 100, 20, 30, 128)
    expect(ratio).toBe(0)
  })

  it("楕円を完全に塗りつぶした場合は1に近い", () => {
    const halfW = 15
    const halfH = 25
    const img = createImageWithFilledEllipse(200, 200, 100, 100, halfW, halfH)
    const ratio = computeEllipticalFillRatio(img, 100, 100, halfW, halfH, 128)
    expect(ratio).toBeGreaterThan(0.95)
  })

  it("縦長楕円（共通テスト形状）が正しく認識される", () => {
    // 共通テスト風: 幅4mm、高さ6.4mm相当（300dpiでの近似ピクセル値）
    const halfW = 24 // ~4mm/2 at 300dpi
    const halfH = 38 // ~6.4mm/2 at 300dpi
    const img = createImageWithFilledEllipse(200, 200, 100, 100, halfW, halfH)
    const ratio = computeEllipticalFillRatio(img, 100, 100, halfW, halfH, 128)
    expect(ratio).toBeGreaterThan(0.95)
  })

  it("楕円外に塗りがある場合はカウントしない", () => {
    const imgWidth = 200
    const imgHeight = 200
    const channels = 3
    const data = Buffer.alloc(imgWidth * imgHeight * channels, 255)

    // 楕円の外側だけ黒く塗る
    const halfW = 20
    const halfH = 30
    for (let py = 0; py < imgHeight; py++) {
      for (let px = 0; px < imgWidth; px++) {
        const dx = (px - 100) / halfW
        const dy = (py - 100) / halfH
        if (dx * dx + dy * dy > 1 && dx * dx + dy * dy < 4) {
          const idx = (py * imgWidth + px) * channels
          data[idx] = 0
          data[idx + 1] = 0
          data[idx + 2] = 0
        }
      }
    }
    const img: RawImageData = {
      data,
      width: imgWidth,
      height: imgHeight,
      channels,
    }

    const ratio = computeEllipticalFillRatio(img, 100, 100, halfW, halfH, 128)
    expect(ratio).toBe(0)
  })

  it("閾値の変更が反映される", () => {
    const imgWidth = 200
    const imgHeight = 200
    const channels = 3
    // グレー(128)で楕円を塗る
    const data = Buffer.alloc(imgWidth * imgHeight * channels, 255)
    const halfW = 20
    const halfH = 30
    for (let py = 0; py < imgHeight; py++) {
      for (let px = 0; px < imgWidth; px++) {
        const dx = (px - 100) / halfW
        const dy = (py - 100) / halfH
        if (dx * dx + dy * dy <= 1) {
          const idx = (py * imgWidth + px) * channels
          data[idx] = 128
          data[idx + 1] = 128
          data[idx + 2] = 128
        }
      }
    }
    const img: RawImageData = {
      data,
      width: imgWidth,
      height: imgHeight,
      channels,
    }

    // 閾値128では「暗い」にならない（128 < 128 は false）
    const ratioLow = computeEllipticalFillRatio(
      img,
      100,
      100,
      halfW,
      halfH,
      128
    )
    expect(ratioLow).toBe(0)

    // 閾値200なら「暗い」になる
    const ratioHigh = computeEllipticalFillRatio(
      img,
      100,
      100,
      halfW,
      halfH,
      200
    )
    expect(ratioHigh).toBeGreaterThan(0.95)
  })
})
