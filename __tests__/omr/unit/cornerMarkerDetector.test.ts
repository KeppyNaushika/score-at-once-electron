import sharp from "sharp"
import { describe, expect, it } from "vitest"

import { detectCornerMarkers } from "../../../electron-src/lib/omr/cornerMarkerDetector"

/**
 * テスト用画像を動的生成
 * 白背景に4隅に黒正方形マーカーを配置
 */
async function createTestImage(
  width: number,
  height: number,
  markerSize: number,
  markerOffset: number
): Promise<string> {
  // 白背景のRGBバッファ
  const channels = 3
  const buf = Buffer.alloc(width * height * channels, 255)

  // 4隅にマーカーを描画
  const corners = [
    { x: markerOffset, y: markerOffset }, // TL
    { x: width - markerOffset - markerSize, y: markerOffset }, // TR
    { x: markerOffset, y: height - markerOffset - markerSize }, // BL
    {
      x: width - markerOffset - markerSize,
      y: height - markerOffset - markerSize,
    }, // BR
  ]

  for (const corner of corners) {
    for (let dy = 0; dy < markerSize; dy++) {
      for (let dx = 0; dx < markerSize; dx++) {
        const px = corner.x + dx
        const py = corner.y + dy
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * channels
          buf[idx] = 0 // R
          buf[idx + 1] = 0 // G
          buf[idx + 2] = 0 // B
        }
      }
    }
  }

  // tmpファイルに保存
  const tmpPath = `/tmp/omr-test-markers-${Date.now()}.png`
  await sharp(buf, { raw: { width, height, channels } }).png().toFile(tmpPath)

  return tmpPath
}

/**
 * マーカーが3つしかない画像を生成（BRなし）
 */
async function createPartialMarkerImage(
  width: number,
  height: number,
  markerSize: number,
  markerOffset: number
): Promise<string> {
  const channels = 3
  const buf = Buffer.alloc(width * height * channels, 255)

  // 3隅のみマーカーを描画（BRなし）
  const corners = [
    { x: markerOffset, y: markerOffset },
    { x: width - markerOffset - markerSize, y: markerOffset },
    { x: markerOffset, y: height - markerOffset - markerSize },
  ]

  for (const corner of corners) {
    for (let dy = 0; dy < markerSize; dy++) {
      for (let dx = 0; dx < markerSize; dx++) {
        const px = corner.x + dx
        const py = corner.y + dy
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * channels
          buf[idx] = 0
          buf[idx + 1] = 0
          buf[idx + 2] = 0
        }
      }
    }
  }

  const tmpPath = `/tmp/omr-test-partial-${Date.now()}.png`
  await sharp(buf, { raw: { width, height, channels } }).png().toFile(tmpPath)

  return tmpPath
}

describe("cornerMarkerDetector", () => {
  it("4隅のマーカーを全て検出できる", async () => {
    const width = 2480 // A4 300dpi相当
    const height = 3508
    const markerSize = 40 // ~3.4mm
    const markerOffset = 25 // ~2.1mm

    const imagePath = await createTestImage(
      width,
      height,
      markerSize,
      markerOffset
    )
    const result = await detectCornerMarkers(imagePath, 128)

    expect(result.success).toBe(true)
    expect(result.markers).toHaveLength(4)
    expect(result.imageWidth).toBe(width)
    expect(result.imageHeight).toBe(height)

    // 各コーナーが検出されている
    const corners = result.markers.map((m) => m.corner).sort()
    expect(corners).toEqual(["BL", "BR", "TL", "TR"])
  })

  it("検出座標がマーカー中心付近にある（誤差5px以内）", async () => {
    const width = 2480
    const height = 3508
    const markerSize = 40
    const markerOffset = 25

    const imagePath = await createTestImage(
      width,
      height,
      markerSize,
      markerOffset
    )
    const result = await detectCornerMarkers(imagePath, 128)

    expect(result.success).toBe(true)

    // 期待される中心座標
    const expected = {
      TL: {
        x: markerOffset + markerSize / 2,
        y: markerOffset + markerSize / 2,
      },
      TR: {
        x: width - markerOffset - markerSize / 2,
        y: markerOffset + markerSize / 2,
      },
      BL: {
        x: markerOffset + markerSize / 2,
        y: height - markerOffset - markerSize / 2,
      },
      BR: {
        x: width - markerOffset - markerSize / 2,
        y: height - markerOffset - markerSize / 2,
      },
    }

    for (const marker of result.markers) {
      const exp = expected[marker.corner]
      expect(Math.abs(marker.centerX - exp.x)).toBeLessThanOrEqual(5)
      expect(Math.abs(marker.centerY - exp.y)).toBeLessThanOrEqual(5)
    }
  })

  it("マーカーが不足している場合はsuccess=falseを返す", async () => {
    const width = 2480
    const height = 3508
    const markerSize = 40
    const markerOffset = 25

    const imagePath = await createPartialMarkerImage(
      width,
      height,
      markerSize,
      markerOffset
    )
    const result = await detectCornerMarkers(imagePath, 128)

    expect(result.success).toBe(false)
    expect(result.markers.length).toBeLessThan(4)
    expect(result.error).toBeDefined()
  })

  it("信頼度が正方形マーカーに対して高い値を返す", async () => {
    const width = 2480
    const height = 3508
    const markerSize = 40
    const markerOffset = 25

    const imagePath = await createTestImage(
      width,
      height,
      markerSize,
      markerOffset
    )
    const result = await detectCornerMarkers(imagePath, 128)

    expect(result.success).toBe(true)
    for (const marker of result.markers) {
      expect(marker.confidence).toBeGreaterThanOrEqual(0.75)
    }
  })

  it("小さい画像でも検出できる", async () => {
    const width = 800
    const height = 1100
    const markerSize = 15
    const markerOffset = 10

    const imagePath = await createTestImage(
      width,
      height,
      markerSize,
      markerOffset
    )
    const result = await detectCornerMarkers(imagePath, 128)

    expect(result.success).toBe(true)
    expect(result.markers).toHaveLength(4)
  })
})
