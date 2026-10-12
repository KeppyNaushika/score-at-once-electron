/**
 * コーナーマーカー検出
 *
 * Mark2の DetectSquares アルゴリズムを移植。
 * 画像の4隅にある黒い正方形マーカーの中心座標を検出する。
 *
 * アルゴリズム:
 * 1. 4隅それぞれに探索領域（隅から1%マージン、幅30%×高さ8%）を設定
 * 2. R値 < colorThreshold のピクセルを「黒」としてマスク
 * 3. オープニングで細い線（罫線・枠線）を剥がす。マーカーに接した線も外れる
 * 4. 8近傍の連結成分から、正方形らしく詰まった成分を選ぶ
 * 5. 正方形でない・探索領域の境界で切れている成分は、位置がずれるので失敗にする。
 *    1% の余白の側で切れているときだけ、余白を外して探し直す
 * 6. バウンディングボックス中心 = マーカー中心座標
 */

import {
  MARKER_SEARCH_HEIGHT_RATIO,
  MARKER_SEARCH_MARGIN_RATIO,
  MARKER_SEARCH_WIDTH_RATIO,
} from "../../../src/lib/omr/markerSearchRegion"
import type {
  CornerDiagnostics,
  DetectedCornerMarker,
  MarkerDetectionResult,
  Point,
  RawImageData,
} from "../../../src/types/omr.types"
import { loadImageRaw } from "./imageProcessor"

type Corner = DetectedCornerMarker["corner"]

/** 探索領域設定 */
interface SearchRegion {
  x: number
  y: number
  width: number
  height: number
  corner: Corner
}

/**
 * オープニングの窓の一辺（画像の短辺に対する比）。
 * A4 300dpi で 4px（約 0.3mm）。これより細い線は剥がれ、マーカー（最小 0.5mm）は残る
 */
const OPENING_KERNEL_RATIO = 0.0015

/** マーカーとして受け入れる縦横比の下限（1 が正方形） */
const MIN_MARKER_ASPECT = 0.8

/**
 * マーカーとして受け入れる充填率の下限。
 * 正方形を 5° 傾けると外接矩形に対して約 0.85 になる（補正が許す回転の上限）
 */
const MIN_MARKER_FILL = 0.75

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
  /** 選んだ成分が探索領域の外側（用紙の端の側）の境界で切れている */
  cutAtOuterEdge: boolean
}

/**
 * RAWイメージデータからコーナーマーカーを検出
 */
export function detectCornerMarkersFromRaw(
  rawImage: RawImageData,
  colorThreshold: number = 128
): MarkerDetectionResult {
  const { width, height } = rawImage
  const kernel = Math.max(
    2,
    Math.round(Math.min(width, height) * OPENING_KERNEL_RATIO)
  )
  const markers: DetectedCornerMarker[] = []
  const diagnostics: CornerDiagnostics[] = []

  for (const region of computeSearchRegions(width, height, true)) {
    let attempt = detectMarkerInRegion(rawImage, region, colorThreshold, kernel)
    // 1% の余白に入り込んだマーカーは、見えている部分だけを拾うと中心がずれる。
    // 余白を外して用紙の端まで探し直す
    if (attempt.cutAtOuterEdge) {
      const widened = computeSearchRegions(width, height, false).find(
        (candidate) => candidate.corner === region.corner
      )!
      attempt = detectMarkerInRegion(rawImage, widened, colorThreshold, kernel)
    }
    diagnostics.push(attempt.diagnostics)
    if (attempt.marker) {
      markers.push(attempt.marker)
    }
  }

  const failReasons = diagnostics
    .filter((diagnostic) => diagnostic.failReason)
    .map((diagnostic) => `${diagnostic.corner}: ${diagnostic.failReason}`)

  return {
    success: markers.length === 4,
    markers,
    imageWidth: width,
    imageHeight: height,
    error:
      markers.length < 4
        ? `${markers.length}/4 のOMRマーカーのみ検出されました（${failReasons.join("、")}）`
        : undefined,
    diagnostics,
  }
}

/**
 * 4隅の探索領域を計算
 *
 * 各隅から1%マージン（withMargin=false なら余白なし）、横幅30%×縦8%の領域を探索する。
 */
function computeSearchRegions(
  imageWidth: number,
  imageHeight: number,
  withMargin: boolean
): SearchRegion[] {
  const marginX = withMargin
    ? Math.floor(imageWidth * MARKER_SEARCH_MARGIN_RATIO)
    : 0
  const marginY = withMargin
    ? Math.floor(imageHeight * MARKER_SEARCH_MARGIN_RATIO)
    : 0
  const searchW = Math.floor(imageWidth * MARKER_SEARCH_WIDTH_RATIO)
  const searchH = Math.floor(imageHeight * MARKER_SEARCH_HEIGHT_RATIO)

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
 * 二値マスクのオープニング（kernel×kernel の正方形で収縮→膨張）。
 *
 * kernel 四方の黒に収まらない画素を落とす。細い線は消え、線に接していたマーカーは
 * 線を剥がした正方形に戻る。積分画像で数えるので窓の大きさに依らず O(画素数)
 */
function openMask(
  mask: Uint8Array,
  rw: number,
  rh: number,
  kernel: number
): Uint8Array {
  const maskSums = integralImage(mask, rw, rh)
  // eroded[y*rw+x] = 1: (x,y) を左上とする kernel 四方がすべて黒
  const eroded = new Uint8Array(rw * rh)
  for (let y = 0; y + kernel <= rh; y++) {
    for (let x = 0; x + kernel <= rw; x++) {
      if (
        rectSum(maskSums, rw, x, y, x + kernel, y + kernel) ===
        kernel * kernel
      ) {
        eroded[y * rw + x] = 1
      }
    }
  }

  // 画素 (x,y) を覆う窓（左上が x-kernel+1..x, y-kernel+1..y）が1つでもあれば残す
  const erodedSums = integralImage(eroded, rw, rh)
  const opened = new Uint8Array(rw * rh)
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (!mask[y * rw + x]) continue
      const left = Math.max(0, x - kernel + 1)
      const top = Math.max(0, y - kernel + 1)
      if (rectSum(erodedSums, rw, left, top, x + 1, y + 1) > 0) {
        opened[y * rw + x] = 1
      }
    }
  }
  return opened
}

/** (rw+1)×(rh+1) の積分画像 */
function integralImage(mask: Uint8Array, rw: number, rh: number): Int32Array {
  const sums = new Int32Array((rw + 1) * (rh + 1))
  for (let y = 0; y < rh; y++) {
    let rowSum = 0
    for (let x = 0; x < rw; x++) {
      rowSum += mask[y * rw + x]
      sums[(y + 1) * (rw + 1) + x + 1] = sums[y * (rw + 1) + x + 1] + rowSum
    }
  }
  return sums
}

/** 積分画像から [left,right)×[top,bottom) の和を引く */
function rectSum(
  sums: Int32Array,
  rw: number,
  left: number,
  top: number,
  right: number,
  bottom: number
): number {
  const stride = rw + 1
  return (
    sums[bottom * stride + right] -
    sums[top * stride + right] -
    sums[bottom * stride + left] +
    sums[top * stride + left]
  )
}

/** 連結成分1つ分の集計 */
interface Component {
  label: number
  pixelCount: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** 8近傍の連結成分にラベルを振る（0 は背景） */
function labelComponents(
  mask: Uint8Array,
  rw: number,
  rh: number
): { labels: Int32Array; components: Component[] } {
  const labels = new Int32Array(rw * rh)
  const components: Component[] = []
  const stack: number[] = []

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue
    const component: Component = {
      label: components.length + 1,
      pixelCount: 0,
      minX: rw,
      minY: rh,
      maxX: -1,
      maxY: -1,
    }
    labels[start] = component.label
    stack.push(start)
    while (stack.length > 0) {
      const pixel = stack.pop()!
      const x = pixel % rw
      const y = (pixel - x) / rw
      component.pixelCount++
      component.minX = Math.min(component.minX, x)
      component.minY = Math.min(component.minY, y)
      component.maxX = Math.max(component.maxX, x)
      component.maxY = Math.max(component.maxY, y)
      for (let ny = Math.max(0, y - 1); ny <= Math.min(rh - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(rw - 1, x + 1); nx++) {
          const neighbor = ny * rw + nx
          if (mask[neighbor] && !labels[neighbor]) {
            labels[neighbor] = component.label
            stack.push(neighbor)
          }
        }
      }
    }
    components.push(component)
  }
  return { labels, components }
}

/**
 * 探索領域内でマーカーを検出
 *
 * 1. 二値化マスクを作成し、オープニングで細い線を剥がす
 * 2. 連結成分から正方形らしく詰まった成分を選ぶ
 * 3. 正方形でない・境界で切れている成分は失敗にする（位置がずれるため）
 */
function detectMarkerInRegion(
  rawImage: RawImageData,
  region: SearchRegion,
  colorThreshold: number,
  kernel: number
): DetectionAttempt {
  const { data, width, height, channels } = rawImage
  const { x: rx, y: ry, width: rw, height: rh } = region
  const totalPixels = rw * rh

  /** 画像上の (imgX, imgY) が黒か（R値で判定、グレースケール近似） */
  const isDark = (imgX: number, imgY: number): boolean =>
    data[(imgY * width + imgX) * channels] < colorThreshold

  // 1. 二値化マスク作成（探索領域内の黒ピクセル）
  const rawMask = new Uint8Array(rw * rh)
  let darkPixels = 0
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      if (isDark(rx + dx, ry + dy)) {
        rawMask[dy * rw + dx] = 1
        darkPixels++
      }
    }
  }
  const mask = openMask(rawMask, rw, rh, kernel)

  // 2. 連結成分
  const { labels, components } = labelComponents(mask, rw, rh)

  // 診断ヘルパー
  const fail = (
    reason: string,
    largestSize = 0,
    largestAspect = 0
  ): DetectionAttempt => ({
    marker: null,
    cutAtOuterEdge: false,
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

  if (components.length === 0) {
    return fail("探索領域内に黒ピクセルの連結成分がありません")
  }

  // 最小面積チェック（ノイズ除去）
  const minArea = Math.max(9, rw * rh * 0.001) // 探索領域の0.1%以上

  // 正方形に近いコンポーネントを優先的に選択
  // 罫線などの細長い連結成分より、マーカー（正方形）を優先する
  let best: Component | null = null
  let bestScore = -1

  // 診断用: 最大コンポーネントの情報
  let largestSize = 0
  let largestAspect = 0

  for (const component of components) {
    const bw = component.maxX - component.minX + 1
    const bh = component.maxY - component.minY + 1
    const aspectRatio = Math.min(bw, bh) / Math.max(bw, bh)

    if (component.pixelCount > largestSize) {
      largestSize = component.pixelCount
      largestAspect = aspectRatio
    }

    if (component.pixelCount < minArea) continue

    // 充填率: 実ピクセル数 / バウンディングボックス面積
    const fillRatio = component.pixelCount / (bw * bh)

    // スコア = アスペクト比(正方形性) × 充填率(密度) × 面積の重み
    // 正方形で密に塗りつぶされたコンポーネントを優先
    const score = aspectRatio * fillRatio * Math.sqrt(component.pixelCount)

    if (score > bestScore) {
      bestScore = score
      best = component
    }
  }

  if (!best) {
    return fail(
      `最小面積(${Math.round(minArea)}px)を超える成分がありません（最大成分: ${largestSize}px）`,
      largestSize,
      largestAspect
    )
  }

  const bboxWidth = best.maxX - best.minX + 1
  const bboxHeight = best.maxY - best.minY + 1
  const aspectRatio =
    Math.min(bboxWidth, bboxHeight) / Math.max(bboxWidth, bboxHeight)
  const fillRatio = best.pixelCount / (bboxWidth * bboxHeight)

  // 3. 境界で切れているか。切れた成分の中心は、見えている部分の中心でしかない
  const bestLabel = best.label
  const touchesRow = (dy: number): number[] =>
    Array.from({ length: rw }, (_, dx) => dx).filter(
      (dx) => labels[dy * rw + dx] === bestLabel
    )
  const touchesColumn = (dx: number): number[] =>
    Array.from({ length: rh }, (_, dy) => dy).filter(
      (dy) => labels[dy * rw + dx] === bestLabel
    )
  /** 境界の外側の画素が黒い（＝マーカーが続いている）か。画像の端なら続きは分からない */
  const cutAbove = (dxs: number[]): boolean =>
    dxs.length > 0 && (ry === 0 || dxs.some((dx) => isDark(rx + dx, ry - 1)))
  const cutBelow = (dxs: number[]): boolean =>
    dxs.length > 0 &&
    (ry + rh === height || dxs.some((dx) => isDark(rx + dx, ry + rh)))
  const cutLeft = (dys: number[]): boolean =>
    dys.length > 0 && (rx === 0 || dys.some((dy) => isDark(rx - 1, ry + dy)))
  const cutRight = (dys: number[]): boolean =>
    dys.length > 0 &&
    (rx + rw === width || dys.some((dy) => isDark(rx + rw, ry + dy)))

  const isTop = region.corner === "TL" || region.corner === "TR"
  const isLeft = region.corner === "TL" || region.corner === "BL"
  const cut = {
    top: best.minY === 0 && cutAbove(touchesRow(0)),
    bottom: best.maxY === rh - 1 && cutBelow(touchesRow(rh - 1)),
    left: best.minX === 0 && cutLeft(touchesColumn(0)),
    right: best.maxX === rw - 1 && cutRight(touchesColumn(rw - 1)),
  }
  const cutOuter =
    (isTop ? cut.top : cut.bottom) || (isLeft ? cut.left : cut.right)
  const cutInner =
    (isTop ? cut.bottom : cut.top) || (isLeft ? cut.right : cut.left)
  // 外側の境界が画像の端でなければ、余白を外して探し直せる
  const outerIsImageEdge =
    (isTop ? ry === 0 : ry + rh === height) &&
    (isLeft ? rx === 0 : rx + rw === width)

  if (cutOuter && !outerIsImageEdge) {
    return {
      ...fail("探索範囲の余白の側で切れています", best.pixelCount, aspectRatio),
      cutAtOuterEdge: true,
    }
  }
  if (cutOuter || cutInner) {
    return fail(
      cutOuter
        ? "OMRマーカーが画像の端で切れています"
        : "OMRマーカーが探索範囲の内側の境界で切れています",
      best.pixelCount,
      aspectRatio
    )
  }

  // 4. 正方形でない成分は、マーカーに太い線や塗りが繋がっている。中心がずれるので採らない
  if (aspectRatio < MIN_MARKER_ASPECT || fillRatio < MIN_MARKER_FILL) {
    return fail(
      `OMRマーカーが正方形になっていません（縦横比 ${aspectRatio.toFixed(2)}・充填率 ${fillRatio.toFixed(2)}）。罫線や枠線が接していないか確認してください`,
      best.pixelCount,
      aspectRatio
    )
  }

  // マーカー中心座標（探索領域ローカル→画像グローバル）
  const centerX = rx + best.minX + bboxWidth / 2
  const centerY = ry + best.minY + bboxHeight / 2

  return {
    marker: {
      centerX,
      centerY,
      size: Math.max(bboxWidth, bboxHeight),
      corner: region.corner,
      // 正方形で密に詰まっているほど高信頼
      confidence: aspectRatio * fillRatio,
    },
    cutAtOuterEdge: false,
    diagnostics: {
      corner: region.corner,
      detected: true,
      darkPixels,
      totalPixels,
      largestComponentSize: best.pixelCount,
      largestComponentAspect: aspectRatio,
    },
  }
}

/**
 * 答案の4隅の座標を [TL, TR, BL, BR] で返す。1隅だけ見つからないときは、
 * 基準（模範解答）の4隅と残り3隅の対応からアフィン変換を求めて推定する。
 *
 * 基準の座標は答案と同じ単位でなくてよい（正規化座標でも模範解答のピクセルでも、
 * アフィン変換が縮尺の違いを吸収する）。2隅以上欠けていれば null
 */
export function resolveAnswerCorners(
  detection: MarkerDetectionResult,
  referenceCorners: Record<Corner, Point>
): {
  corners: [Point, Point, Point, Point]
  estimatedCorner: Corner | null
} | null {
  const cornerOrder: Corner[] = ["TL", "TR", "BL", "BR"]
  const detected = new Map<Corner, Point>(
    detection.markers.map((marker) => [
      marker.corner,
      { x: marker.centerX, y: marker.centerY },
    ])
  )
  const missing = cornerOrder.filter((corner) => !detected.has(corner))
  if (missing.length > 1) return null

  let estimatedCorner: Corner | null = null
  if (missing.length === 1) {
    estimatedCorner = missing[0]
    const [anchor, first, second] = cornerOrder.filter(
      (corner) => corner !== estimatedCorner
    )
    const estimated = mapByAffine(
      [
        referenceCorners[anchor],
        referenceCorners[first],
        referenceCorners[second],
      ],
      [detected.get(anchor)!, detected.get(first)!, detected.get(second)!],
      referenceCorners[estimatedCorner]
    )
    if (!estimated) return null
    detected.set(estimatedCorner, estimated)
  }

  return {
    corners: cornerOrder.map((corner) => detected.get(corner)!) as [
      Point,
      Point,
      Point,
      Point,
    ],
    estimatedCorner,
  }
}

/**
 * 3点の対応 from[i] → to[i] で決まるアフィン変換で target を写す。
 * 3点が一直線に並んでいて変換が決まらなければ null
 */
function mapByAffine(
  from: [Point, Point, Point],
  to: [Point, Point, Point],
  target: Point
): Point | null {
  const [fromOrigin, fromA, fromB] = from
  const [toOrigin, toA, toB] = to
  // target - fromOrigin = s·(fromA - fromOrigin) + t·(fromB - fromOrigin) を解き、
  // 同じ s, t を写した側の基底に掛ける
  const ax = fromA.x - fromOrigin.x
  const ay = fromA.y - fromOrigin.y
  const bx = fromB.x - fromOrigin.x
  const by = fromB.y - fromOrigin.y
  const det = ax * by - ay * bx
  if (Math.abs(det) < 1e-12) return null
  const px = target.x - fromOrigin.x
  const py = target.y - fromOrigin.y
  const s = (px * by - py * bx) / det
  const t = (ax * py - ay * px) / det
  return {
    x: toOrigin.x + s * (toA.x - toOrigin.x) + t * (toB.x - toOrigin.x),
    y: toOrigin.y + s * (toA.y - toOrigin.y) + t * (toB.y - toOrigin.y),
  }
}
