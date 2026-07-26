/**
 * 画像ピクセル操作ユーティリティ
 *
 * sharpを使ったRAWピクセルバッファ操作。
 * OMR認識パイプラインの基盤。
 */

import sharp from "sharp"

import type {
  BoundingBox,
  EllipticalInkStats,
  RawImageData,
} from "../../../src/types/omr.types"

/**
 * 画像をRAWピクセルバッファとして読み込む
 * @param imagePath 画像ファイルパス
 * @returns RawImageData (RGB 3チャンネル)
 */
export async function loadImageRaw(imagePath: string): Promise<RawImageData> {
  const { data, info } = await sharp(imagePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  }
}

/**
 * バッファから画像をRAWピクセルバッファとして読み込む
 */
export async function loadImageRawFromBuffer(
  buffer: Buffer
): Promise<RawImageData> {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  }
}

/**
 * RAWバッファから矩形領域のピクセルを切り出す
 * @returns 切り出し領域のRGBバッファ
 */
export function extractRegionPixels(
  rawData: RawImageData,
  region: BoundingBox
): Buffer {
  const { data, width, channels } = rawData

  // 領域をクランプ
  const x0 = Math.max(0, Math.floor(region.x))
  const y0 = Math.max(0, Math.floor(region.y))
  const x1 = Math.min(rawData.width, Math.ceil(region.x + region.width))
  const y1 = Math.min(rawData.height, Math.ceil(region.y + region.height))
  const rw = x1 - x0
  const rh = y1 - y0

  const regionBuf = Buffer.alloc(rw * rh * channels)

  for (let row = 0; row < rh; row++) {
    const srcOffset = ((y0 + row) * width + x0) * channels
    const dstOffset = row * rw * channels
    data.copy(regionBuf, dstOffset, srcOffset, srcOffset + rw * channels)
  }

  return regionBuf
}

/**
 * ピクセルバッファ内の暗いピクセルの比率（塗りつぶし率）を計算
 *
 * R値が threshold 未満のピクセルを「暗い」と判定。
 *
 * @param pixels RGBピクセルバッファ
 * @param width 領域幅
 * @param height 領域高さ
 * @param channels チャンネル数（通常3）
 * @param threshold 暗さ閾値（0-255）
 * @returns 暗いピクセルの比率（0-1）
 */
export function computeFillRatio(
  pixels: Buffer,
  width: number,
  height: number,
  channels: number,
  threshold: number
): number {
  const totalPixels = width * height
  if (totalPixels === 0) return 0

  let darkCount = 0
  for (let i = 0; i < totalPixels; i++) {
    const red = pixels[i * channels]
    if (red < threshold) {
      darkCount++
    }
  }

  return darkCount / totalPixels
}

/**
 * 円形領域のピクセルの塗りつぶし率を計算
 *
 * 指定された中心と半径の円内のピクセルのみを対象とする。
 */
export function computeCircularFillRatio(
  rawData: RawImageData,
  centerX: number,
  centerY: number,
  radius: number,
  threshold: number
): number {
  const { data, width, height, channels } = rawData
  const radiusSquared = radius * radius

  let totalPixels = 0
  let darkCount = 0

  const x0 = Math.max(0, Math.floor(centerX - radius))
  const x1 = Math.min(width - 1, Math.ceil(centerX + radius))
  const y0 = Math.max(0, Math.floor(centerY - radius))
  const y1 = Math.min(height - 1, Math.ceil(centerY + radius))

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = px - centerX
      const dy = py - centerY
      if (dx * dx + dy * dy <= radiusSquared) {
        totalPixels++
        const idx = (py * width + px) * channels
        const luminance =
          channels >= 3
            ? 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
            : data[idx]
        if (luminance < threshold) {
          darkCount++
        }
      }
    }
  }

  return totalPixels === 0 ? 0 : darkCount / totalPixels
}

/**
 * 楕円形領域のピクセル輝度を度数分布に積む
 *
 * 大津法で暗さ閾値を自動決定するための母集団収集。
 * 画像全体ではなくバブル領域だけを積むことで、余白に埋もれず2峰性が残る。
 *
 * @param histogram 長さ256の度数配列（直接加算する）
 */
export function accumulateEllipticalLuminanceHistogram(
  rawData: RawImageData,
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
  histogram: number[]
): void {
  const { data, width, height, channels } = rawData

  const x0 = Math.max(0, Math.floor(centerX - halfWidth))
  const x1 = Math.min(width - 1, Math.ceil(centerX + halfWidth))
  const y0 = Math.max(0, Math.floor(centerY - halfHeight))
  const y1 = Math.min(height - 1, Math.ceil(centerY + halfHeight))

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = (px - centerX) / halfWidth
      const dy = (py - centerY) / halfHeight
      if (dx * dx + dy * dy > 1) continue

      const idx = (py * width + px) * channels
      const luminance =
        channels >= 3
          ? 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
          : data[idx]
      histogram[Math.min(255, Math.max(0, Math.round(luminance)))]++
    }
  }
}

/**
 * 中心側の領域を分ける正規化半径の2乗
 *
 * 楕円の面積のうち内側がちょうど半分になる位置（r = 1/√2）。
 * 中心側と縁側のピクセル数が揃うので、両者の比較が偏らない。
 */
const INNER_RADIUS_SQUARED = 0.5

/**
 * 楕円形領域の塗り具合を測る
 *
 * 共通テスト風の横長楕円マーク認識用。
 * (x/rx)^2 + (y/ry)^2 <= 1 の楕円内のピクセルのみを対象とする。
 *
 * 塗りつぶし率だけでは「濃く塗ったマーク」と「薄く広がった消し跡」を区別できない。
 * 中心側／縁側の塗りつぶし率と濃さを併せて測り、判定側で使い分ける。
 */
export function computeEllipticalInkStats(
  rawData: RawImageData,
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
  threshold: number
): EllipticalInkStats {
  const { data, width, height, channels } = rawData

  let totalPixels = 0
  let darkCount = 0
  let innerTotalPixels = 0
  let innerDarkCount = 0
  let rimTotalPixels = 0
  let rimDarkCount = 0
  let darknessSum = 0

  const x0 = Math.max(0, Math.floor(centerX - halfWidth))
  const x1 = Math.min(width - 1, Math.ceil(centerX + halfWidth))
  const y0 = Math.max(0, Math.floor(centerY - halfHeight))
  const y1 = Math.min(height - 1, Math.ceil(centerY + halfHeight))

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = (px - centerX) / halfWidth
      const dy = (py - centerY) / halfHeight
      const radiusSquared = dx * dx + dy * dy
      if (radiusSquared > 1) continue

      const idx = (py * width + px) * channels
      // グレースケール輝度で判定（RGB加重平均）
      const luminance =
        channels >= 3
          ? 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
          : data[idx]
      const isDark = luminance < threshold
      const isInner = radiusSquared <= INNER_RADIUS_SQUARED

      totalPixels++
      if (isInner) innerTotalPixels++
      else rimTotalPixels++

      if (isDark) {
        darkCount++
        darknessSum += 1 - luminance / 255
        if (isInner) innerDarkCount++
        else rimDarkCount++
      }
    }
  }

  const fillRatio = ratioOf(darkCount, totalPixels)

  return {
    fillRatio,
    // バブルが画像端で切れて中心側の画素が1つも入らないことがある。
    // ここで0を返すと判定側が「中心が塗られていない」と読んで正しいマークを
    // 消し跡として退けてしまうので、測れないときは全体の値で代用する
    innerFillRatio:
      innerTotalPixels === 0 ? fillRatio : innerDarkCount / innerTotalPixels,
    rimFillRatio:
      rimTotalPixels === 0 ? fillRatio : rimDarkCount / rimTotalPixels,
    inkDarkness: ratioOf(darknessSum, darkCount),
  }
}

/** 母数が0のときに NaN を返さない除算 */
function ratioOf(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}
