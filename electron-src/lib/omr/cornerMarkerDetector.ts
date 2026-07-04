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
  CornerDiagnostics,
  DetectedCornerMarker,
  MarkerDetectionResult,
  RawImageData,
} from "../../../src/types/omr.types"
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

/** detectMarkerInRegion の内部戻り値 */
interface DetectionAttempt {
  marker: DetectedCornerMarker | null
  diagnostics: CornerDiagnostics
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
  const diagnostics: CornerDiagnostics[] = []

  for (const region of searchRegions) {
    const attempt = detectMarkerInRegion(rawImage, region, colorThreshold)
    diagnostics.push(attempt.diagnostics)
    if (attempt.marker) {
      markers.push(attempt.marker)
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
    diagnostics,
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
): DetectionAttempt {
  const { data, width, channels } = rawImage
  const { x: rx, y: ry, width: rw, height: rh } = region
  const totalPixels = rw * rh

  // 1. 二値化マスク作成（探索領域内の黒ピクセル）
  const mask = new Uint8Array(rw * rh)
  let darkPixels = 0
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const imgX = rx + dx
      const imgY = ry + dy
      const idx = (imgY * width + imgX) * channels
      // R値で判定（グレースケール近似）
      if (data[idx] < colorThreshold) {
        mask[dy * rw + dx] = 1
        darkPixels++
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

  function find(node: number): number {
    while (parent[node] !== node) {
      parent[node] = parent[parent[node]] // path compression
      node = parent[node]
    }
    return node
  }

  function union(nodeA: number, nodeB: number): void {
    const rootA = find(nodeA)
    const rootB = find(nodeB)
    if (rootA === rootB) return
    if (rank[rootA] < rank[rootB]) {
      parent[rootA] = rootB
    } else if (rank[rootA] > rank[rootB]) {
      parent[rootB] = rootA
    } else {
      parent[rootB] = rootA
      rank[rootA]++
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

  // 診断ヘルパー
  const fail = (
    reason: string,
    largestSize = 0,
    largestAspect = 0
  ): DetectionAttempt => ({
    marker: null,
    diagnostics: {
      corner: region.corner,
      detected: false,
      darkPixels,
      totalPixels,
      largestComponentSize: largestSize,
      largestComponentAspect: largestAspect,
      failReason: reason,
    },
  })

  if (componentSizes.size === 0) {
    return fail("探索領域内に黒ピクセルの連結成分がありません")
  }

  // 最小面積チェック（ノイズ除去）
  const minArea = Math.max(9, rw * rh * 0.001) // 探索領域の0.1%以上

  // 正方形に近いコンポーネントを優先的に選択
  // 罫線などの細長い連結成分より、マーカー（正方形）を優先する
  let bestRoot = -1
  let bestScore = -1

  // 診断用: 最大コンポーネントの情報
  let largestSize = 0
  let largestAspect = 0

  for (const [root, compSize] of componentSizes) {
    const bounds = componentBounds.get(root)!
    const bw = bounds.maxX - bounds.minX + 1
    const bh = bounds.maxY - bounds.minY + 1
    const maxDim = Math.max(bw, bh)
    const aspectRatio = Math.min(bw, bh) / maxDim

    if (compSize > largestSize) {
      largestSize = compSize
      largestAspect = aspectRatio
    }

    if (compSize < minArea) continue

    // 充填率: 実ピクセル数 / バウンディングボックス面積
    const fillRatio = compSize / (bw * bh)

    // スコア = アスペクト比(正方形性) × 充填率(密度) × 面積の重み
    // 正方形で密に塗りつぶされたコンポーネントを優先
    const score = aspectRatio * fillRatio * Math.sqrt(compSize)

    if (score > bestScore) {
      bestScore = score
      bestRoot = root
    }
  }

  if (bestRoot === -1) {
    return fail(
      `最小面積(${Math.round(minArea)}px)を超える成分がありません（最大成分: ${largestSize}px）`,
      largestSize,
      largestAspect
    )
  }

  const bounds = componentBounds.get(bestRoot)!
  const bboxWidth = bounds.maxX - bounds.minX + 1
  const bboxHeight = bounds.maxY - bounds.minY + 1
  const size = Math.max(bboxWidth, bboxHeight)

  // マーカー中心座標（探索領域ローカル→画像グローバル）
  const centerX = rx + bounds.minX + bboxWidth / 2
  const centerY = ry + bounds.minY + bboxHeight / 2

  // アスペクト比チェック（正方形に近いか）
  const aspectRatio = Math.min(bboxWidth, bboxHeight) / size
  const confidence = aspectRatio // 正方形に近いほど高信頼

  const bestSize = componentSizes.get(bestRoot) ?? 0

  return {
    marker: {
      centerX,
      centerY,
      size,
      corner: region.corner,
      confidence,
    },
    diagnostics: {
      corner: region.corner,
      detected: true,
      darkPixels,
      totalPixels,
      largestComponentSize: bestSize,
      largestComponentAspect: aspectRatio,
    },
  }
}
