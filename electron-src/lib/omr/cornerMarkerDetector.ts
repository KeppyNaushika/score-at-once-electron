/**
 * コーナーマーカー検出
 *
 * Mark2の DetectSquares アルゴリズムを移植。
 * 画像の4隅にある黒い正方形マーカーの中心座標を検出する。
 *
 * アルゴリズム:
 * 1. 4隅それぞれに探索領域（隅から1%マージン、幅30%×高さ8%）を設定
 * 2. R値 < colorThreshold のピクセルを「黒」としてマスク
 * 3. 8近傍連結成分分析（Union-Find）で最大コンポーネントを検出
 * 4. バウンディングボックス中心 = マーカー中心座標
 */

import type {
  DetectedCornerMarker,
  MarkerDetectionResult,
  RawImageData,
} from "../../../types/omr.types"
import { loadImageRaw } from "./imageProcessor"

/** 探索領域設定 */
interface SearchRegion {
  x: number
  y: number
  width: number
  height: number
  corner: "TL" | "TR" | "BL" | "BR"
}

/**
 * 画像ファイルからコーナーマーカーを検出
 */
export async function detectCornerMarkers(
  imagePath: string,
  colorThreshold: number = 128
): Promise<MarkerDetectionResult> {
  const rawImage = await loadImageRaw(imagePath)
  return detectCornerMarkersFromRaw(rawImage, colorThreshold)
}

/**
 * RAWイメージデータからコーナーマーカーを検出
 */
export function detectCornerMarkersFromRaw(
  rawImage: RawImageData,
  colorThreshold: number = 128
): MarkerDetectionResult {
  const { width, height } = rawImage
  const searchRegions = computeSearchRegions(width, height)
  const markers: DetectedCornerMarker[] = []

  for (const region of searchRegions) {
    const marker = detectMarkerInRegion(rawImage, region, colorThreshold)
    if (marker) {
      markers.push(marker)
    }
  }

  return {
    success: markers.length === 4,
    markers,
    imageWidth: width,
    imageHeight: height,
    error:
      markers.length < 4
        ? `${markers.length}/4 のマーカーのみ検出されました`
        : undefined,
  }
}

/**
 * 4隅の探索領域を計算
 *
 * 各隅から1%マージン、横幅30%×縦8%の領域を探索する。
 */
function computeSearchRegions(
  imageWidth: number,
  imageHeight: number
): SearchRegion[] {
  const marginX = Math.floor(imageWidth * 0.01)
  const marginY = Math.floor(imageHeight * 0.01)
  const searchW = Math.floor(imageWidth * 0.3)
  const searchH = Math.floor(imageHeight * 0.08)

  return [
    {
      x: marginX,
      y: marginY,
      width: searchW,
      height: searchH,
      corner: "TL",
    },
    {
      x: imageWidth - marginX - searchW,
      y: marginY,
      width: searchW,
      height: searchH,
      corner: "TR",
    },
    {
      x: marginX,
      y: imageHeight - marginY - searchH,
      width: searchW,
      height: searchH,
      corner: "BL",
    },
    {
      x: imageWidth - marginX - searchW,
      y: imageHeight - marginY - searchH,
      width: searchW,
      height: searchH,
      corner: "BR",
    },
  ]
}

/**
 * 探索領域内でマーカーを検出
 *
 * 1. 二値化マスクを作成
 * 2. Union-Find で連結成分分析
 * 3. 最大コンポーネントのバウンディングボックス中心を返す
 */
function detectMarkerInRegion(
  rawImage: RawImageData,
  region: SearchRegion,
  colorThreshold: number
): DetectedCornerMarker | null {
  const { data, width, channels } = rawImage
  const { x: rx, y: ry, width: rw, height: rh } = region

  // 1. 二値化マスク作成（探索領域内の黒ピクセル）
  const mask = new Uint8Array(rw * rh)
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const imgX = rx + dx
      const imgY = ry + dy
      const idx = (imgY * width + imgX) * channels
      // R値で判定（グレースケール近似）
      if (data[idx] < colorThreshold) {
        mask[dy * rw + dx] = 1
      }
    }
  }

  // 2. 8近傍連結成分分析（Union-Find）
  const parent = new Int32Array(rw * rh)
  const rank = new Int32Array(rw * rh)
  for (let i = 0; i < parent.length; i++) {
    parent[i] = -1 // -1 = 背景
  }

  // 黒ピクセルのみUnion-Findに登録
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      parent[i] = i
    }
  }

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]] // path compression
      x = parent[x]
    }
    return x
  }

  function union(a: number, b: number): void {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return
    if (rank[ra] < rank[rb]) {
      parent[ra] = rb
    } else if (rank[ra] > rank[rb]) {
      parent[rb] = ra
    } else {
      parent[rb] = ra
      rank[ra]++
    }
  }

  // 8近傍で連結
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const idx = dy * rw + dx
      if (!mask[idx]) continue

      // 右、右下、下、左下の4方向をチェック（上・左は既に処理済み）
      const neighbors = [
        [dx + 1, dy],
        [dx + 1, dy + 1],
        [dx, dy + 1],
        [dx - 1, dy + 1],
        // 上方向も必要（上・左上・右上）
        [dx - 1, dy],
        [dx - 1, dy - 1],
        [dx, dy - 1],
        [dx + 1, dy - 1],
      ]

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < rw && ny >= 0 && ny < rh) {
          const nIdx = ny * rw + nx
          if (mask[nIdx]) {
            union(idx, nIdx)
          }
        }
      }
    }
  }

  // 3. 最大コンポーネントを見つける
  const componentSizes = new Map<number, number>()
  const componentBounds = new Map<
    number,
    { minX: number; minY: number; maxX: number; maxY: number }
  >()

  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const idx = dy * rw + dx
      if (parent[idx] === -1) continue

      const root = find(idx)
      componentSizes.set(root, (componentSizes.get(root) ?? 0) + 1)

      const bounds = componentBounds.get(root)
      if (bounds) {
        bounds.minX = Math.min(bounds.minX, dx)
        bounds.minY = Math.min(bounds.minY, dy)
        bounds.maxX = Math.max(bounds.maxX, dx)
        bounds.maxY = Math.max(bounds.maxY, dy)
      } else {
        componentBounds.set(root, {
          minX: dx,
          minY: dy,
          maxX: dx,
          maxY: dy,
        })
      }
    }
  }

  if (componentSizes.size === 0) return null

  // 最大コンポーネントを選択
  let maxRoot = -1
  let maxSize = 0
  for (const [root, size] of componentSizes) {
    if (size > maxSize) {
      maxSize = size
      maxRoot = root
    }
  }

  if (maxRoot === -1) return null

  // 最小面積チェック（ノイズ除去）
  const minArea = Math.max(9, rw * rh * 0.001) // 探索領域の0.1%以上
  if (maxSize < minArea) return null

  const bounds = componentBounds.get(maxRoot)!
  const bboxWidth = bounds.maxX - bounds.minX + 1
  const bboxHeight = bounds.maxY - bounds.minY + 1
  const size = Math.max(bboxWidth, bboxHeight)

  // マーカー中心座標（探索領域ローカル→画像グローバル）
  const centerX = rx + bounds.minX + bboxWidth / 2
  const centerY = ry + bounds.minY + bboxHeight / 2

  // アスペクト比チェック（正方形に近いか）
  const aspectRatio = Math.min(bboxWidth, bboxHeight) / size
  const confidence = aspectRatio // 正方形に近いほど高信頼

  return {
    centerX,
    centerY,
    size,
    corner: region.corner,
    confidence,
  }
}
