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
    const corners = result.markers.map((marker) => marker.corner).sort()
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
      const expectedCenter = expected[marker.corner]
      expect(Math.abs(marker.centerX - expectedCenter.x)).toBeLessThanOrEqual(5)
      expect(Math.abs(marker.centerY - expectedCenter.y)).toBeLessThanOrEqual(5)
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

  it("罫線が探索領域内にあってもマーカーを正しく検出できる", async () => {
    const width = 2480
    const height = 3508
    const markerSize = 59 // 5mm @ 300dpi
    const markerOffset = 35 // 3mm @ 300dpi
    const channels = 3
    const buf = Buffer.alloc(width * height * channels, 255)

    // 4隅にマーカーを描画
    const corners = [
      { x: markerOffset, y: markerOffset },
      { x: width - markerOffset - markerSize, y: markerOffset },
      { x: markerOffset, y: height - markerOffset - markerSize },
      {
        x: width - markerOffset - markerSize,
        y: height - markerOffset - markerSize,
      },
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

    // 罫線を描画（幅2px、探索領域に入る位置に水平・垂直線を配置）
    // 上端から100px: 水平罫線（探索領域の高さ8%=280px内）
    for (let x = 0; x < width; x++) {
      for (let thickness = 0; thickness < 2; thickness++) {
        const y = 100 + thickness
        const idx = (y * width + x) * channels
        buf[idx] = 0
        buf[idx + 1] = 0
        buf[idx + 2] = 0
      }
    }
    // 左端から100px: 垂直罫線（探索領域の幅30%=744px内）
    for (let y = 0; y < height; y++) {
      for (let thickness = 0; thickness < 2; thickness++) {
        const x = 100 + thickness
        const idx = (y * width + x) * channels
        buf[idx] = 0
        buf[idx + 1] = 0
        buf[idx + 2] = 0
      }
    }

    const tmpPath = `/tmp/omr-test-with-lines-${Date.now()}.png`
    await sharp(buf, { raw: { width, height, channels } }).png().toFile(tmpPath)

    const result = await detectCornerMarkers(tmpPath, 128)

    expect(result.success).toBe(true)
    expect(result.markers).toHaveLength(4)

    // 各コーナーが検出されている
    const detectedCorners = result.markers.map((marker) => marker.corner).sort()
    expect(detectedCorners).toEqual(["BL", "BR", "TL", "TR"])
  })

  // =========================================================================
  // 追加テスト: 包括的なコーナーマーカー検出テスト
  // =========================================================================

  describe("複数用紙サイズ対応", () => {
    it.each([
      { name: "A4", width: 2480, height: 3508 },
      { name: "A3", width: 3508, height: 4961 },
      { name: "B4", width: 3035, height: 4299 },
      { name: "B5", width: 2150, height: 3035 },
      { name: "A4横", width: 3508, height: 2480 },
    ])(
      "$name ($width×$height) で4隅マーカーを検出できる",
      async ({ width, height }) => {
        const markerSize = 59 // 5mm @ 300dpi
        const markerOffset = 35 // 3mm @ 300dpi

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

        const corners = result.markers.map((marker) => marker.corner).sort()
        expect(corners).toEqual(["BL", "BR", "TL", "TR"])
      }
    )
  })

  describe("プリンターの印刷マージン対応", () => {
    it("用紙端5mm切り取りでもマーカーを検出できる（最大40%欠損）", async () => {
      const width = 2480
      const height = 3508
      const markerSize = 59 // 5mm @ 300dpi
      const markerOffset = 35 // 3mm @ 300dpi
      const printMargin = 59 // 5mm @ 300dpi
      const channels = 3
      const buf = Buffer.alloc(width * height * channels, 255)

      // 4隅にマーカーを描画
      const markerCorners = [
        { x: markerOffset, y: markerOffset },
        { x: width - markerOffset - markerSize, y: markerOffset },
        { x: markerOffset, y: height - markerOffset - markerSize },
        {
          x: width - markerOffset - markerSize,
          y: height - markerOffset - markerSize,
        },
      ]
      for (const corner of markerCorners) {
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

      // 用紙端5mm（59px）を白で塗りつぶし（プリンターマージンのシミュレーション）
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (
            x < printMargin ||
            x >= width - printMargin ||
            y < printMargin ||
            y >= height - printMargin
          ) {
            const idx = (y * width + x) * channels
            buf[idx] = 255
            buf[idx + 1] = 255
            buf[idx + 2] = 255
          }
        }
      }

      const tmpPath = `/tmp/omr-test-print-margin-${Date.now()}.png`
      await sharp(buf, { raw: { width, height, channels } })
        .png()
        .toFile(tmpPath)

      const result = await detectCornerMarkers(tmpPath, 128)

      expect(result.success).toBe(true)
      expect(result.markers).toHaveLength(4)

      const corners = result.markers.map((marker) => marker.corner).sort()
      expect(corners).toEqual(["BL", "BR", "TL", "TR"])
    })
  })

  describe("スキャナーノイズ耐性", () => {
    it("ランダムノイズ（0.5%密度）があっても4マーカーを検出できる", async () => {
      const width = 2480
      const height = 3508
      const markerSize = 59
      const markerOffset = 35
      const channels = 3
      const buf = Buffer.alloc(width * height * channels, 255)

      // 4隅にマーカーを描画
      const markerCorners = [
        { x: markerOffset, y: markerOffset },
        { x: width - markerOffset - markerSize, y: markerOffset },
        { x: markerOffset, y: height - markerOffset - markerSize },
        {
          x: width - markerOffset - markerSize,
          y: height - markerOffset - markerSize,
        },
      ]
      for (const corner of markerCorners) {
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

      // 擬似ランダムノイズを散布（再現性のあるシード的ループ）
      // 画像全体の約0.5%密度 = width*height*0.005 個の点
      const noiseCount = Math.floor(width * height * 0.005)
      for (let i = 0; i < noiseCount; i++) {
        const nx = (i * 7919) % width
        const ny = (i * 7907) % height
        // 1-3pxの点を描画
        const dotSize = 1 + (i % 3)
        for (let dy = 0; dy < dotSize; dy++) {
          for (let dx = 0; dx < dotSize; dx++) {
            const px = nx + dx
            const py = ny + dy
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (py * width + px) * channels
              buf[idx] = 0
              buf[idx + 1] = 0
              buf[idx + 2] = 0
            }
          }
        }
      }

      const tmpPath = `/tmp/omr-test-noise-${Date.now()}.png`
      await sharp(buf, { raw: { width, height, channels } })
        .png()
        .toFile(tmpPath)

      const result = await detectCornerMarkers(tmpPath, 128)

      expect(result.success).toBe(true)
      expect(result.markers).toHaveLength(4)

      const corners = result.markers.map((marker) => marker.corner).sort()
      expect(corners).toEqual(["BL", "BR", "TL", "TR"])
    })
  })

  describe("答案のズレ（傾き/オフセット）", () => {
    it("マーカーが右に10px、下に15pxずれても検出できる", async () => {
      const width = 2480
      const height = 3508
      const markerSize = 59
      const markerOffset = 35
      const shiftX = 10
      const shiftY = 15
      const channels = 3
      const buf = Buffer.alloc(width * height * channels, 255)

      // 4隅にマーカーを描画（全体的にオフセット）
      const markerCorners = [
        { x: markerOffset + shiftX, y: markerOffset + shiftY },
        {
          x: width - markerOffset - markerSize + shiftX,
          y: markerOffset + shiftY,
        },
        {
          x: markerOffset + shiftX,
          y: height - markerOffset - markerSize + shiftY,
        },
        {
          x: width - markerOffset - markerSize + shiftX,
          y: height - markerOffset - markerSize + shiftY,
        },
      ]
      for (const corner of markerCorners) {
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

      const tmpPath = `/tmp/omr-test-shifted-${Date.now()}.png`
      await sharp(buf, { raw: { width, height, channels } })
        .png()
        .toFile(tmpPath)

      const result = await detectCornerMarkers(tmpPath, 128)

      expect(result.success).toBe(true)
      expect(result.markers).toHaveLength(4)

      const corners = result.markers.map((marker) => marker.corner).sort()
      expect(corners).toEqual(["BL", "BR", "TL", "TR"])
    })
  })

  describe("罫線が密な解答用紙", () => {
    it("探索領域内に多数の水平・垂直罫線グリッドがあっても検出できる", async () => {
      const width = 2480
      const height = 3508
      const markerSize = 59
      const markerOffset = 35
      const channels = 3
      const buf = Buffer.alloc(width * height * channels, 255)

      // 4隅にマーカーを描画
      const markerCorners = [
        { x: markerOffset, y: markerOffset },
        { x: width - markerOffset - markerSize, y: markerOffset },
        { x: markerOffset, y: height - markerOffset - markerSize },
        {
          x: width - markerOffset - markerSize,
          y: height - markerOffset - markerSize,
        },
      ]
      for (const corner of markerCorners) {
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

      // 探索領域の範囲を計算（1%マージン、幅30%×高さ8%）
      const marginX = Math.floor(width * 0.01)
      const marginY = Math.floor(height * 0.01)
      const searchW = Math.floor(width * 0.3)
      const searchH = Math.floor(height * 0.08)

      // 水平罫線グリッド（探索領域内、20px間隔、太さ1-2px）
      // 上側探索領域内
      for (let lineY = marginY + 5; lineY < marginY + searchH; lineY += 20) {
        const thickness = lineY % 40 < 20 ? 1 : 2
        for (let x = marginX; x < marginX + searchW; x++) {
          for (let t = 0; t < thickness; t++) {
            const py = lineY + t
            if (py >= 0 && py < height && x >= 0 && x < width) {
              const idx = (py * width + x) * channels
              buf[idx] = 0
              buf[idx + 1] = 0
              buf[idx + 2] = 0
            }
          }
        }
      }

      // 垂直罫線グリッド（探索領域内、30px間隔、太さ1px）
      for (let lineX = marginX + 5; lineX < marginX + searchW; lineX += 30) {
        for (let y = marginY; y < marginY + searchH; y++) {
          if (y >= 0 && y < height && lineX >= 0 && lineX < width) {
            const idx = (y * width + lineX) * channels
            buf[idx] = 0
            buf[idx + 1] = 0
            buf[idx + 2] = 0
          }
        }
      }

      // マーカーに1px隣接する罫線を追加（TLマーカーの右辺に接触）
      const tlMarkerRight = markerOffset + markerSize
      for (let y = markerOffset; y < markerOffset + markerSize; y++) {
        if (
          tlMarkerRight >= 0 &&
          tlMarkerRight < width &&
          y >= 0 &&
          y < height
        ) {
          const idx = (y * width + tlMarkerRight) * channels
          buf[idx] = 0
          buf[idx + 1] = 0
          buf[idx + 2] = 0
        }
      }

      const tmpPath = `/tmp/omr-test-dense-grid-${Date.now()}.png`
      await sharp(buf, { raw: { width, height, channels } })
        .png()
        .toFile(tmpPath)

      const result = await detectCornerMarkers(tmpPath, 128)

      expect(result.success).toBe(true)
      expect(result.markers).toHaveLength(4)

      const detectedCorners = result.markers
        .map((marker) => marker.corner)
        .sort()
      expect(detectedCorners).toEqual(["BL", "BR", "TL", "TR"])
    })
  })

  describe("罫線がマーカーに接触する最悪ケース", () => {
    it("マーカーの一辺に長い罫線が連結すると、検出されたTLマーカーの信頼度が低下する", async () => {
      const width = 2480
      const height = 3508
      const markerSize = 59
      const markerOffset = 35
      const channels = 3
      const buf = Buffer.alloc(width * height * channels, 255)

      // 4隅にマーカーを描画
      const markerCorners = [
        { x: markerOffset, y: markerOffset },
        { x: width - markerOffset - markerSize, y: markerOffset },
        { x: markerOffset, y: height - markerOffset - markerSize },
        {
          x: width - markerOffset - markerSize,
          y: height - markerOffset - markerSize,
        },
      ]
      for (const corner of markerCorners) {
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

      // TLマーカーの右辺に長い水平罫線を連結（マーカー右端から探索領域の右端まで）
      // これによりTLの連結成分は横長になり、正方形スコアが低下する
      const tlRight = markerOffset + markerSize
      const lineLength = Math.floor(width * 0.3) // 探索領域幅分
      const tlCenterY = markerOffset + Math.floor(markerSize / 2)
      for (let x = tlRight; x < tlRight + lineLength; x++) {
        for (let t = 0; t < 2; t++) {
          // 太さ2px
          const py = tlCenterY + t
          if (x >= 0 && x < width && py >= 0 && py < height) {
            const idx = (py * width + x) * channels
            buf[idx] = 0
            buf[idx + 1] = 0
            buf[idx + 2] = 0
          }
        }
      }

      const tmpPath = `/tmp/omr-test-connected-line-${Date.now()}.png`
      await sharp(buf, { raw: { width, height, channels } })
        .png()
        .toFile(tmpPath)

      const result = await detectCornerMarkers(tmpPath, 128)

      // アルゴリズムは最大スコアのコンポーネントを選択するため、
      // マーカー+罫線の連結成分が選ばれる可能性がある。
      // その場合、バウンディングボックスが横長になるため信頼度が低下する。
      // 他の3マーカーは正常に検出されるべき。
      const tlMarker = result.markers.find((marker) => marker.corner === "TL")
      const otherMarkers = result.markers.filter(
        (marker) => marker.corner !== "TL"
      )

      // 他の3マーカーは必ず検出される
      expect(otherMarkers).toHaveLength(3)
      const otherCorners = otherMarkers.map((marker) => marker.corner).sort()
      expect(otherCorners).toEqual(["BL", "BR", "TR"])

      // 他の3マーカーは高信頼度
      for (const marker of otherMarkers) {
        expect(marker.confidence).toBeGreaterThanOrEqual(0.9)
      }

      if (tlMarker) {
        // TLが検出された場合、信頼度が他のマーカーより低いことを確認
        // （バウンディングボックスが正方形から外れるため）
        const minOtherConfidence = Math.min(
          ...otherMarkers.map((marker) => marker.confidence)
        )
        expect(tlMarker.confidence).toBeLessThan(minOtherConfidence)
      } else {
        // TLが検出されない場合、success=falseで3マーカーのみ
        expect(result.success).toBe(false)
        expect(result.markers).toHaveLength(3)
      }
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
        const width = 2480
        const height = 3508
        const markerOffset = 35

        const imagePath = await createTestImage(
          width,
          height,
          markerSize,
          markerOffset
        )
        const result = await detectCornerMarkers(imagePath, 128)

        expect(result.success).toBe(true)
        expect(result.markers).toHaveLength(4)

        const corners = result.markers.map((marker) => marker.corner).sort()
        expect(corners).toEqual(["BL", "BR", "TL", "TR"])
      }
    )
  })

  describe("グレースケール近似（アンチエイリアス）", () => {
    it("辺2pxがグレー（R=80）、内部が黒（R=0）でも検出できる", async () => {
      const width = 2480
      const height = 3508
      const markerSize = 59
      const markerOffset = 35
      const channels = 3
      const buf = Buffer.alloc(width * height * channels, 255)

      // 4隅にアンチエイリアス付きマーカーを描画
      const markerCorners = [
        { x: markerOffset, y: markerOffset },
        { x: width - markerOffset - markerSize, y: markerOffset },
        { x: markerOffset, y: height - markerOffset - markerSize },
        {
          x: width - markerOffset - markerSize,
          y: height - markerOffset - markerSize,
        },
      ]

      for (const corner of markerCorners) {
        for (let dy = 0; dy < markerSize; dy++) {
          for (let dx = 0; dx < markerSize; dx++) {
            const px = corner.x + dx
            const py = corner.y + dy
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (py * width + px) * channels
              // 辺から2px以内はグレー（R=80）、それ以外は黒（R=0）
              const distFromEdge = Math.min(
                dx,
                dy,
                markerSize - 1 - dx,
                markerSize - 1 - dy
              )
              const color = distFromEdge < 2 ? 80 : 0
              buf[idx] = color
              buf[idx + 1] = color
              buf[idx + 2] = color
            }
          }
        }
      }

      const tmpPath = `/tmp/omr-test-antialias-${Date.now()}.png`
      await sharp(buf, { raw: { width, height, channels } })
        .png()
        .toFile(tmpPath)

      const result = await detectCornerMarkers(tmpPath, 128)

      expect(result.success).toBe(true)
      expect(result.markers).toHaveLength(4)

      const corners = result.markers.map((marker) => marker.corner).sort()
      expect(corners).toEqual(["BL", "BR", "TL", "TR"])
    })
  })
})
