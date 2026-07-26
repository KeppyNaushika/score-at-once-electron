/**
 * 画像処理ユーティリティ テスト
 *
 * computeCircularFillRatio / computeEllipticalInkStats の
 * 塗りつぶし判定と、消し跡切り分け用の特徴量を検証する。
 */

import { describe, expect, it } from "vitest"

import {
  computeCircularFillRatio,
  computeEllipticalInkStats,
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
    const image = createWhiteImage(100, 100)
    const ratio = computeCircularFillRatio(image, 50, 50, 20, 128)
    expect(ratio).toBe(0)
  })

  it("円を完全に塗りつぶした画像では塗りつぶし率が1に近い", () => {
    const image = createImageWithFilledCircle(200, 200, 100, 100, 30)
    const ratio = computeCircularFillRatio(image, 100, 100, 30, 128)
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
    const image: RawImageData = {
      data,
      width: imgWidth,
      height: imgHeight,
      channels,
    }

    const ratio = computeCircularFillRatio(image, cx, cy, radius, 128)
    expect(ratio).toBeGreaterThan(0.4)
    expect(ratio).toBeLessThan(0.6)
  })
})

describe("computeEllipticalInkStats", () => {
  it("完全に白い画像では塗りつぶし率が0", () => {
    const image = createWhiteImage(200, 200)
    const ratio = computeEllipticalInkStats(
      image,
      100,
      100,
      20,
      30,
      128
    ).fillRatio
    expect(ratio).toBe(0)
  })

  it("楕円を完全に塗りつぶした場合は1に近い", () => {
    const halfW = 15
    const halfH = 25
    const image = createImageWithFilledEllipse(200, 200, 100, 100, halfW, halfH)
    const ratio = computeEllipticalInkStats(
      image,
      100,
      100,
      halfW,
      halfH,
      128
    ).fillRatio
    expect(ratio).toBeGreaterThan(0.95)
  })

  it("縦長楕円（共通テスト形状）が正しく認識される", () => {
    // 共通テスト風: 幅4mm、高さ6.4mm相当（300dpiでの近似ピクセル値）
    const halfW = 24 // ~4mm/2 at 300dpi
    const halfH = 38 // ~6.4mm/2 at 300dpi
    const image = createImageWithFilledEllipse(200, 200, 100, 100, halfW, halfH)
    const ratio = computeEllipticalInkStats(
      image,
      100,
      100,
      halfW,
      halfH,
      128
    ).fillRatio
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
    const image: RawImageData = {
      data,
      width: imgWidth,
      height: imgHeight,
      channels,
    }

    const ratio = computeEllipticalInkStats(
      image,
      100,
      100,
      halfW,
      halfH,
      128
    ).fillRatio
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
    const image: RawImageData = {
      data,
      width: imgWidth,
      height: imgHeight,
      channels,
    }

    // 閾値100なら「暗い」にならない（luminance≈128 > 100）
    const ratioLow = computeEllipticalInkStats(
      image,
      100,
      100,
      halfW,
      halfH,
      100
    ).fillRatio
    expect(ratioLow).toBe(0)

    // 閾値200なら「暗い」になる
    const ratioHigh = computeEllipticalInkStats(
      image,
      100,
      100,
      halfW,
      halfH,
      200
    ).fillRatio
    expect(ratioHigh).toBeGreaterThan(0.95)
  })

  describe("消し跡切り分け用の特徴量", () => {
    const imgWidth = 200
    const imgHeight = 200
    const cx = 100
    const cy = 100
    const halfW = 30
    const halfH = 40

    /**
     * 楕円の指定領域を指定の濃さで塗った画像を作る
     *
     * @param region "all"=全域 / "inner"=中心側（面積の内半分）/ "rim"=縁側
     */
    function createInkedImage(
      gray: number,
      region: "all" | "inner" | "rim"
    ): RawImageData {
      const channels = 3
      const data = Buffer.alloc(imgWidth * imgHeight * channels, 255)

      for (let py = 0; py < imgHeight; py++) {
        for (let px = 0; px < imgWidth; px++) {
          const dx = (px - cx) / halfW
          const dy = (py - cy) / halfH
          const radiusSquared = dx * dx + dy * dy
          if (radiusSquared > 1) continue

          const isInner = radiusSquared <= 0.5
          if (region === "inner" && !isInner) continue
          if (region === "rim" && isInner) continue

          const idx = (py * imgWidth + px) * channels
          data[idx] = gray
          data[idx + 1] = gray
          data[idx + 2] = gray
        }
      }

      return { data, width: imgWidth, height: imgHeight, channels }
    }

    it("全域を濃く塗ると中心・縁とも高く、濃さも最大に近い", () => {
      const stats = computeEllipticalInkStats(
        createInkedImage(0, "all"),
        cx,
        cy,
        halfW,
        halfH,
        128
      )

      expect(stats.innerFillRatio).toBeGreaterThan(0.95)
      expect(stats.rimFillRatio).toBeGreaterThan(0.9)
      expect(stats.inkDarkness).toBeGreaterThan(0.95)
    })

    it("縁だけ塗ると中心が空になる（輪郭なぞりの検出）", () => {
      const stats = computeEllipticalInkStats(
        createInkedImage(0, "rim"),
        cx,
        cy,
        halfW,
        halfH,
        128
      )

      expect(stats.innerFillRatio).toBeLessThan(0.05)
      expect(stats.rimFillRatio).toBeGreaterThan(0.9)
      // 全体では半分程度しか塗られていない
      expect(stats.fillRatio).toBeGreaterThan(0.4)
      expect(stats.fillRatio).toBeLessThan(0.6)
    })

    it("薄い塗りは塗りつぶし率が高くても濃さが低い（消し跡の検出）", () => {
      // 閾値200では「暗い」と判定されるが、濃さとしては薄い
      const stats = computeEllipticalInkStats(
        createInkedImage(180, "all"),
        cx,
        cy,
        halfW,
        halfH,
        200
      )

      expect(stats.fillRatio).toBeGreaterThan(0.95)
      // 1 - 180/255 ≈ 0.29
      expect(stats.inkDarkness).toBeGreaterThan(0.25)
      expect(stats.inkDarkness).toBeLessThan(0.35)
    })

    it("バブルが画像端で切れても中心を空と誤認しない", () => {
      // 中心側の画素が1つも入らない位置。0を返すと「中心が空」と読まれ、
      // 正しく塗られたマークが消し跡として退けられてしまう
      const stats = computeEllipticalInkStats(
        createInkedImage(0, "all"),
        cx,
        // 楕円の大半が画像外に出る位置へずらす
        imgHeight + halfH - 2,
        halfW,
        halfH,
        128
      )

      expect(stats.innerFillRatio).toBe(stats.fillRatio)
    })

    it("暗いピクセルが無ければ濃さは0", () => {
      const stats = computeEllipticalInkStats(
        createWhiteImage(imgWidth, imgHeight),
        cx,
        cy,
        halfW,
        halfH,
        128
      )

      expect(stats.fillRatio).toBe(0)
      expect(stats.inkDarkness).toBe(0)
    })
  })
})
