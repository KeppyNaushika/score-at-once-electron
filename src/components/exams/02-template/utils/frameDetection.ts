/**
 * 採点枠検出の計算本体（純粋関数）
 *
 * RGBA のピクセル列を受け取り、採点枠の候補を相対座標で返す。
 * DOM・Worker の API には依存しないので、Worker からも Node からも呼べる。
 *
 * ## 方式: 罫線で囲まれた領域
 *
 * グレースケール → 二値化 → 罫線の抽出 → 罫線以外の画素の連結成分 → フィルタリング
 *
 * 罫線（長い水平・垂直の黒の連なり）だけを抜き出し、罫線で囲まれた白い領域を
 * 1つの枠とする。閉じた領域だけが枠になるので、文字・分数の横棒・下線のように
 * 枠の壁に届かない線には反応しない。他の枠に丸ごと含まれる枠（方眼のマス、
 * 解答欄の中の小さな箱）は落とし、外側の枠を残す。
 *
 * ## 仕切り線
 *
 * 壁に届かない線でも、枠の幅（縦の仕切りなら高さ）の minDividerLength 以上の長さが
 * あれば仕切り線とみなし、壁まで延ばして枠を割る。ただし割ってできる枠のどれかが
 * 最小高さ（縦の仕切りなら最小幅）に満たないなら、その向きには割らない。線の間隔が
 * 最小高さより狭い方眼や、小さな枠の中の文字の線はこれで割られずに残る（マスが
 * 最小高さより大きく枠いっぱいに広がる方眼は割られる）。minDividerLength が
 * 1（100%）なら壁から壁まで届く線しか仕切りにならず、延ばす処理は要らない。
 *
 * ## 長さの単位
 *
 * 罫線の最短の長さ・最小幅・最小高さは mm で受け取り、ページの用紙サイズと画像の
 * 画素数から画素に換算する。仕切り線の長さだけは、その枠の幅（高さ）に対する比。
 */

import { mmToPixels } from "@/lib/paperSize"

import type { DetectionSettings } from "../types"

/** 検出結果の矩形（IDなし — メインスレッドで付与） */
export type DetectedRectResult = {
  x: number
  y: number
  width: number
  height: number
}

/** ピクセル座標の領域（両端を含む） */
type PixelRegion = {
  left: number
  top: number
  right: number
  bottom: number
  touchesImageEdge: boolean
}

/** 枠として残す最小の大きさ（px） */
type MinFrameSize = { width: number; height: number }

/** 仕切り線。太い線が隣り合う行（列）にまたがるので、その範囲（両端を含む）で持つ */
type DividerBand = { from: number; to: number }

// --- 定数 ---
/** 枠検出用の最大長辺ピクセル数（呼び出し側はこれを超える画像を縮小して渡す） */
export const MAX_PROCESSING_EDGE = 2000
/** 罫線の途切れ（点線・かすれ）をつなぐ最大の隙間（px） */
const LINE_GAP_TOLERANCE = 4
/** 罫線を探すとき上下（左右）に何px ずれても同じ線とみなすか。スキャンの傾き対策 */
const LINE_SKEW_TOLERANCE = 1
/** 罫線どうしの交点の隙間を塞ぐために罫線を太らせる回数（1回 = 1px） */
const LINE_SEAL_ITERATIONS = 1
/** 他の枠に含まれるかを判定するときの許容誤差（px） */
const CONTAINMENT_TOLERANCE = 2
/** 大津のしきい値に掛ける倍率。1 より大きいほど薄い線も黒とみなす */
const THRESHOLD_FACTOR = 1.15

// --- 画像処理関数 ---

function toGrayscale(rgba: Uint8ClampedArray, pixelCount: number): Uint8Array {
  const gray = new Uint8Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4
    gray[i] = Math.round(
      rgba[offset] * 0.2126 +
        rgba[offset + 1] * 0.7152 +
        rgba[offset + 2] * 0.0722
    )
  }
  return gray
}

function computeOtsuThreshold(gray: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0)
  gray.forEach((level) => {
    histogram[level]++
  })
  const total = gray.length
  const sumAll = histogram.reduce((acc, count, level) => acc + level * count, 0)
  let sumBackground = 0
  let weightBackground = 0
  let maxVariance = 0
  let bestThreshold = 128
  for (let level = 0; level < 256; level++) {
    weightBackground += histogram[level]
    if (weightBackground === 0) continue
    const weightForeground = total - weightBackground
    if (weightForeground === 0) break
    sumBackground += level * histogram[level]
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sumAll - sumBackground) / weightForeground
    const variance =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) *
      (meanBackground - meanForeground)
    if (variance > maxVariance) {
      maxVariance = variance
      bestThreshold = level
    }
  }
  return bestThreshold
}

/** 黒（インク）の画素を 1 にした二値画像 */
function binarize(gray: Uint8Array): Uint8Array {
  const threshold = Math.min(250, computeOtsuThreshold(gray) * THRESHOLD_FACTOR)
  return gray.map((level) => (level <= threshold ? 1 : 0))
}

// --- 罫線の抽出 ---

/**
 * 水平の罫線を lineMask に書き込む。
 * 上下 LINE_SKEW_TOLERANCE 行のどれかが黒なら黒とみなして横に走査し、
 * 隙間 LINE_GAP_TOLERANCE 以下でつながる minLength 以上の連なりを罫線とする
 */
function markHorizontalLines(
  ink: Uint8Array,
  lineMask: Uint8Array,
  w: number,
  h: number,
  minLength: number
): void {
  for (let y = 0; y < h; y++) {
    let runStart = -1
    let lastInk = -1
    for (let x = 0; x <= w; x++) {
      let isInk = false
      if (x < w) {
        for (
          let dy = -LINE_SKEW_TOLERANCE;
          dy <= LINE_SKEW_TOLERANCE && !isInk;
          dy++
        ) {
          const neighborY = y + dy
          if (neighborY >= 0 && neighborY < h && ink[neighborY * w + x]) {
            isInk = true
          }
        }
      }
      if (isInk) {
        if (runStart < 0) runStart = x
        lastInk = x
      } else if (runStart >= 0 && x - lastInk > LINE_GAP_TOLERANCE) {
        if (lastInk - runStart + 1 >= minLength) {
          lineMask.fill(1, y * w + runStart, y * w + lastInk + 1)
        }
        runStart = -1
      }
    }
  }
}

/** 垂直の罫線を lineMask に書き込む（markHorizontalLines の縦版） */
function markVerticalLines(
  ink: Uint8Array,
  lineMask: Uint8Array,
  w: number,
  h: number,
  minLength: number
): void {
  for (let x = 0; x < w; x++) {
    let runStart = -1
    let lastInk = -1
    for (let y = 0; y <= h; y++) {
      let isInk = false
      if (y < h) {
        for (
          let dx = -LINE_SKEW_TOLERANCE;
          dx <= LINE_SKEW_TOLERANCE && !isInk;
          dx++
        ) {
          const neighborX = x + dx
          if (neighborX >= 0 && neighborX < w && ink[y * w + neighborX]) {
            isInk = true
          }
        }
      }
      if (isInk) {
        if (runStart < 0) runStart = y
        lastInk = y
      } else if (runStart >= 0 && y - lastInk > LINE_GAP_TOLERANCE) {
        if (lastInk - runStart + 1 >= minLength) {
          for (let lineY = runStart; lineY <= lastInk; lineY++) {
            lineMask[lineY * w + x] = 1
          }
        }
        runStart = -1
      }
    }
  }
}

/** 罫線を上下左右に 1px 太らせる（交点の隙間を塞ぐ） */
function thicken(lineMask: Uint8Array, w: number, h: number): Uint8Array {
  const thickened = new Uint8Array(lineMask.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const index = y * w + x
      thickened[index] =
        lineMask[index] ||
        (x > 0 && lineMask[index - 1]) ||
        (x < w - 1 && lineMask[index + 1]) ||
        (y > 0 && lineMask[index - w]) ||
        (y < h - 1 && lineMask[index + w])
          ? 1
          : 0
    }
  }
  return thickened
}

// --- 罫線で囲まれた領域 ---

/** 罫線でない画素の連結成分（4近傍）を外接矩形で返す */
function findEnclosedRegions(
  lineMask: Uint8Array,
  w: number,
  h: number
): PixelRegion[] {
  const visited = new Uint8Array(lineMask.length)
  const stack = new Int32Array(lineMask.length)
  const regions: PixelRegion[] = []

  for (let seed = 0; seed < lineMask.length; seed++) {
    if (lineMask[seed] || visited[seed]) continue
    const region: PixelRegion = {
      left: w,
      top: h,
      right: 0,
      bottom: 0,
      touchesImageEdge: false,
    }
    let stackSize = 0
    const pushNeighbor = (neighbor: number) => {
      if (!lineMask[neighbor] && !visited[neighbor]) {
        visited[neighbor] = 1
        stack[stackSize++] = neighbor
      }
    }
    stack[stackSize++] = seed
    visited[seed] = 1
    while (stackSize > 0) {
      const index = stack[--stackSize]
      const x = index % w
      const y = (index - x) / w
      region.left = Math.min(region.left, x)
      region.right = Math.max(region.right, x)
      region.top = Math.min(region.top, y)
      region.bottom = Math.max(region.bottom, y)
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        region.touchesImageEdge = true
      }
      if (x > 0) pushNeighbor(index - 1)
      if (x < w - 1) pushNeighbor(index + 1)
      if (y > 0) pushNeighbor(index - w)
      if (y < h - 1) pushNeighbor(index + w)
    }
    regions.push(region)
  }
  return regions
}

const regionArea = (region: PixelRegion) =>
  (region.right - region.left + 1) * (region.bottom - region.top + 1)

/** inner が outer に丸ごと含まれ、outer の方が大きいか */
const isContainedIn = (inner: PixelRegion, outer: PixelRegion) =>
  outer !== inner &&
  outer.left - CONTAINMENT_TOLERANCE <= inner.left &&
  outer.top - CONTAINMENT_TOLERANCE <= inner.top &&
  outer.right + CONTAINMENT_TOLERANCE >= inner.right &&
  outer.bottom + CONTAINMENT_TOLERANCE >= inner.bottom &&
  regionArea(outer) > regionArea(inner)

// --- 仕切り線 ---

/**
 * 枠の中で、枠の幅（縦の仕切りなら高さ）の minDividerLength 以上の長さがある
 * 横線（縦線）を探す。隣り合う行（列）は1本の仕切り線にまとめる
 */
function findDividerBands(
  lineMask: Uint8Array,
  w: number,
  region: PixelRegion,
  isHorizontal: boolean,
  minDividerLength: number
): DividerBand[] {
  const [alongStart, alongEnd] = isHorizontal
    ? [region.left, region.right]
    : [region.top, region.bottom]
  const [acrossStart, acrossEnd] = isHorizontal
    ? [region.top, region.bottom]
    : [region.left, region.right]
  const requiredLength = (alongEnd - alongStart + 1) * minDividerLength
  const bands: DividerBand[] = []

  for (let across = acrossStart + 1; across < acrossEnd; across++) {
    let longestRun = 0
    let runLength = 0
    let gapLength = 0
    for (let along = alongStart; along <= alongEnd; along++) {
      const index = isHorizontal ? across * w + along : along * w + across
      if (lineMask[index]) {
        runLength += gapLength + 1
        gapLength = 0
        longestRun = Math.max(longestRun, runLength)
      } else if (runLength > 0) {
        gapLength++
        if (gapLength > LINE_GAP_TOLERANCE) {
          runLength = 0
          gapLength = 0
        }
      }
    }
    if (longestRun < requiredLength) continue
    const lastBand = bands[bands.length - 1]
    if (lastBand && lastBand.to === across - 1) {
      lastBand.to = across
    } else {
      bands.push({ from: across, to: across })
    }
  }
  return bands
}

/** 仕切り線で割ってできる枠（壁〜線、線〜線の間）が、どれも minPieceSize 以上か */
function allPiecesAtLeast(
  bands: DividerBand[],
  start: number,
  end: number,
  minPieceSize: number
): boolean {
  const pieceStarts = [start, ...bands.map((band) => band.to + 1)]
  const pieceEnds = [...bands.map((band) => band.from - 1), end]
  return pieceStarts.every(
    (pieceStart, index) => pieceEnds[index] - pieceStart + 1 >= minPieceSize
  )
}

/**
 * 壁に届かない仕切り線を、壁から壁まで延ばして lineMask に書き込む。
 * 全部の枠で仕切り線を探してから書き込む（書き込みが他の枠の判定を変えないように）
 */
function extendDividers(
  lineMask: Uint8Array,
  w: number,
  frames: PixelRegion[],
  minDividerLength: number,
  minFrameSize: MinFrameSize
): void {
  const extensions = frames.flatMap((region) =>
    [true, false].flatMap((isHorizontal) => {
      const bands = findDividerBands(
        lineMask,
        w,
        region,
        isHorizontal,
        minDividerLength
      )
      if (bands.length === 0) return []
      const fits = isHorizontal
        ? allPiecesAtLeast(
            bands,
            region.top,
            region.bottom,
            minFrameSize.height
          )
        : allPiecesAtLeast(bands, region.left, region.right, minFrameSize.width)
      return fits ? [{ region, isHorizontal, bands }] : []
    })
  )

  extensions.forEach(({ region, isHorizontal, bands }) => {
    bands.forEach((band) => {
      for (let across = band.from; across <= band.to; across++) {
        if (isHorizontal) {
          lineMask.fill(
            1,
            across * w + region.left,
            across * w + region.right + 1
          )
        } else {
          for (let along = region.top; along <= region.bottom; along++) {
            lineMask[along * w + across] = 1
          }
        }
      }
    })
  })
}

// --- メインパイプライン ---

/**
 * @param pageSize ページの用紙サイズ名（"A4"等）。mm の設定を画素に換算するのに使う
 */
export function detectRects(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  settings: DetectionSettings,
  pageSize: string
): DetectedRectResult[] {
  const ink = binarize(toGrayscale(rgba, w * h))

  const toPixels = (mm: number) => mmToPixels(mm, pageSize, w, h)
  const minLineLength = Math.max(
    1,
    Math.round(toPixels(settings.minLineLengthMm))
  )
  const minFrameSize: MinFrameSize = {
    width: toPixels(settings.minWidthMm),
    height: toPixels(settings.minHeightMm),
  }
  let lineMask: Uint8Array = new Uint8Array(w * h)
  markHorizontalLines(ink, lineMask, w, h, minLineLength)
  markVerticalLines(ink, lineMask, w, h, minLineLength)
  for (let i = 0; i < LINE_SEAL_ITERATIONS; i++) {
    lineMask = thicken(lineMask, w, h)
  }

  // 画像の端に触れる領域は用紙の外側（どの枠にも囲まれていない余白）
  const findFrames = () =>
    findEnclosedRegions(lineMask, w, h).filter(
      (region) =>
        !region.touchesImageEdge &&
        region.right - region.left + 1 >= minFrameSize.width &&
        region.bottom - region.top + 1 >= minFrameSize.height
    )

  let enclosedRegions = findFrames()
  if (settings.minDividerLength < 1) {
    extendDividers(
      lineMask,
      w,
      enclosedRegions,
      settings.minDividerLength,
      minFrameSize
    )
    enclosedRegions = findFrames()
  }
  const outermostRegions = enclosedRegions.filter(
    (inner) => !enclosedRegions.some((outer) => isContainedIn(inner, outer))
  )

  return outermostRegions.map((region) => ({
    x: region.left / w,
    y: region.top / h,
    width: (region.right - region.left + 1) / w,
    height: (region.bottom - region.top + 1) / h,
  }))
}
