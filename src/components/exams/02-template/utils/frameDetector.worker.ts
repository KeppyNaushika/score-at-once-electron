/**
 * 枠検出Web Worker
 *
 * メインスレッドからImageDataを受け取り、
 * 枠検出の重い計算処理をバックグラウンドで実行する。
 */

/** 水平線 */
type HLine = { y: number; x1: number; x2: number }

/** 垂直線 */
type VLine = { x: number; y1: number; y2: number }

/** ピクセル座標の矩形 */
type PixelRect = { x: number; y: number; width: number; height: number }

/** 検出結果の矩形（IDなし — メインスレッドで付与） */
type DetectedRectResult = {
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

/** Workerへのリクエスト */
export interface DetectionRequest {
  type: "detect"
  imageBuffer: ArrayBuffer
  width: number
  height: number
  settings: {
    lineExtension: number
    minWidth: number
    minHeight: number
    sensitivity: number
  }
}

/** Workerからのレスポンス */
export interface DetectionResponse {
  type: "result"
  rects: DetectedRectResult[]
}

// --- 定数 ---
const DUPLICATE_TOLERANCE = 5
const MIN_LINE_LENGTH_RATIO = 0.02
const MAX_PROCESSING_EDGE = 2000
const PARAM_REFERENCE_DIM = 2000
const EDGE_MARGIN_RATIO = 0.015

/** 矩形構築に使う線の最大本数（多すぎるとO(H²)ループが爆発する） */
const MAX_LINES_FOR_RECT_BUILD = 100

// --- パラメータ ---
function getSensitivityParams(sensitivity: number, refDimension: number) {
  const s = Math.max(1, Math.min(5, sensitivity))
  const scale = refDimension / PARAM_REFERENCE_DIM
  return {
    thresholdFactor: [1.0, 0.85, 0.7, 0.55, 0.4][s - 1],
    dilationIterations: [0, 1, 1, 2, 2][s - 1],
    lineGapTolerance: Math.max(1, Math.round([1, 3, 5, 8, 12][s - 1] * scale)),
    lineMergeTolerance: Math.max(
      1,
      Math.round([3, 5, 6, 8, 10][s - 1] * scale)
    ),
    intersectionTolerance: Math.max(
      1,
      Math.round([5, 7, 8, 10, 12][s - 1] * scale)
    ),
  }
}

// --- 画像処理関数 ---

function toGrayscale(
  data: Uint8ClampedArray,
  pixelCount: number
): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4
    gray[i] = Math.round(
      data[idx] * 0.2126 + data[idx + 1] * 0.7152 + data[idx + 2] * 0.0722
    )
  }
  return gray
}

function computeOtsuThreshold(gray: Uint8ClampedArray): number {
  const histogram = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++
  }
  const total = gray.length
  let sumAll = 0
  for (let i = 0; i < 256; i++) {
    sumAll += i * histogram[i]
  }
  let sumBg = 0
  let weightBg = 0
  let maxVariance = 0
  let bestThreshold = 128
  for (let t = 0; t < 256; t++) {
    weightBg += histogram[t]
    if (weightBg === 0) continue
    const weightFg = total - weightBg
    if (weightFg === 0) break
    sumBg += t * histogram[t]
    const meanBg = sumBg / weightBg
    const meanFg = (sumAll - sumBg) / weightFg
    const variance = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg)
    if (variance > maxVariance) {
      maxVariance = variance
      bestThreshold = t
    }
  }
  return bestThreshold
}

function adaptiveBinarize(
  gray: Uint8ClampedArray,
  thresholdFactor: number
): Uint8ClampedArray {
  const binary = new Uint8ClampedArray(gray.length)
  const otsuThreshold = computeOtsuThreshold(gray)
  const threshold = Math.min(255, Math.round(otsuThreshold * thresholdFactor))
  for (let i = 0; i < gray.length; i++) {
    binary[i] = gray[i] <= threshold ? 255 : 0
  }
  return binary
}

function dilate(
  binary: Uint8ClampedArray,
  w: number,
  h: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(binary.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let hasWhite = false
      for (let dy = -1; dy <= 1 && !hasWhite; dy++) {
        for (let dx = -1; dx <= 1 && !hasWhite; dx++) {
          const ny = y + dy
          const nx = x + dx
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            if (binary[ny * w + nx] === 255) {
              hasWhite = true
            }
          }
        }
      }
      result[y * w + x] = hasWhite ? 255 : 0
    }
  }
  return result
}

// --- 線検出 ---

function detectHorizontalLines(
  binary: Uint8ClampedArray,
  w: number,
  h: number,
  gapTolerance: number,
  mergeTolerance: number
): HLine[] {
  const lines: HLine[] = []
  const minLength = Math.floor(w * MIN_LINE_LENGTH_RATIO)

  for (let y = 0; y < h; y++) {
    let lineStart = -1
    let gapCount = 0
    for (let x = 0; x < w; x++) {
      if (binary[y * w + x] === 255) {
        if (lineStart === -1) lineStart = x
        gapCount = 0
      } else {
        if (lineStart !== -1) {
          gapCount++
          if (gapCount > gapTolerance) {
            const lineEnd = x - gapCount
            if (lineEnd - lineStart >= minLength) {
              lines.push({ y, x1: lineStart, x2: lineEnd })
            }
            lineStart = -1
            gapCount = 0
          }
        }
      }
    }
    if (lineStart !== -1) {
      const lineEnd = gapCount > 0 ? w - 1 - gapCount : w - 1
      if (lineEnd - lineStart >= minLength) {
        lines.push({ y, x1: lineStart, x2: lineEnd })
      }
    }
  }

  return mergeHLines(lines, mergeTolerance)
}

function detectVerticalLines(
  binary: Uint8ClampedArray,
  w: number,
  h: number,
  gapTolerance: number,
  mergeTolerance: number
): VLine[] {
  const lines: VLine[] = []
  const minLength = Math.floor(h * MIN_LINE_LENGTH_RATIO)

  for (let x = 0; x < w; x++) {
    let lineStart = -1
    let gapCount = 0
    for (let y = 0; y < h; y++) {
      if (binary[y * w + x] === 255) {
        if (lineStart === -1) lineStart = y
        gapCount = 0
      } else {
        if (lineStart !== -1) {
          gapCount++
          if (gapCount > gapTolerance) {
            const lineEnd = y - gapCount
            if (lineEnd - lineStart >= minLength) {
              lines.push({ x, y1: lineStart, y2: lineEnd })
            }
            lineStart = -1
            gapCount = 0
          }
        }
      }
    }
    if (lineStart !== -1) {
      const lineEnd = gapCount > 0 ? h - 1 - gapCount : h - 1
      if (lineEnd - lineStart >= minLength) {
        lines.push({ x, y1: lineStart, y2: lineEnd })
      }
    }
  }

  return mergeVLines(lines, mergeTolerance)
}

function mergeHLines(lines: HLine[], mergeTolerance: number): HLine[] {
  if (lines.length === 0) return []
  lines.sort((lineA, lineB) => lineA.y - lineB.y || lineA.x1 - lineB.x1)
  const merged: HLine[] = []
  for (const line of lines) {
    const last = merged[merged.length - 1]
    if (
      last &&
      Math.abs(last.y - line.y) <= mergeTolerance &&
      line.x1 <= last.x2 + mergeTolerance
    ) {
      last.x2 = Math.max(last.x2, line.x2)
    } else {
      merged.push({ ...line })
    }
  }
  return merged
}

function mergeVLines(lines: VLine[], mergeTolerance: number): VLine[] {
  if (lines.length === 0) return []
  lines.sort((lineA, lineB) => lineA.x - lineB.x || lineA.y1 - lineB.y1)
  const merged: VLine[] = []
  for (const line of lines) {
    const last = merged[merged.length - 1]
    if (
      last &&
      Math.abs(last.x - line.x) <= mergeTolerance &&
      line.y1 <= last.y2 + mergeTolerance
    ) {
      last.y2 = Math.max(last.y2, line.y2)
    } else {
      merged.push({ ...line })
    }
  }
  return merged
}

// --- 矩形構築 ---

function linesIntersect(
  hLine: HLine,
  vLine: VLine,
  tolerance: number
): boolean {
  return (
    vLine.x >= hLine.x1 - tolerance &&
    vLine.x <= hLine.x2 + tolerance &&
    hLine.y >= vLine.y1 - tolerance &&
    hLine.y <= vLine.y2 + tolerance
  )
}

function intersectSorted(a: number[], b: number[]): number[] {
  const result: number[] = []
  let ai = 0
  let bi = 0
  while (ai < a.length && bi < b.length) {
    if (a[ai] === b[bi]) {
      result.push(a[ai])
      ai++
      bi++
    } else if (a[ai] < b[bi]) {
      ai++
    } else {
      bi++
    }
  }
  return result
}

function buildRectsFromLines(
  hLines: HLine[],
  vLines: VLine[],
  intersectionTolerance: number
): PixelRect[] {
  if (hLines.length < 2 || vLines.length < 2) return []

  const rects: PixelRect[] = []

  // Phase 1: 交差マップ構築
  const hToV: number[][] = new Array(hLines.length)
  for (let i = 0; i < hLines.length; i++) {
    const intersecting: number[] = []
    for (let j = 0; j < vLines.length; j++) {
      if (linesIntersect(hLines[i], vLines[j], intersectionTolerance)) {
        intersecting.push(j)
      }
    }
    hToV[i] = intersecting
  }

  // Phase 2: 水平線ペア × 共通垂直線ペア
  for (let i = 0; i < hLines.length; i++) {
    if (hToV[i].length < 2) continue
    for (let j = i + 1; j < hLines.length; j++) {
      const top = hLines[i]
      const bottom = hLines[j]
      const overlapX1 = Math.max(top.x1, bottom.x1)
      const overlapX2 = Math.min(top.x2, bottom.x2)
      if (overlapX2 - overlapX1 < 10) continue
      if (hToV[j].length < 2) continue

      const shared = intersectSorted(hToV[i], hToV[j])
      if (shared.length < 2) continue

      for (let k = 0; k < shared.length; k++) {
        for (let l = k + 1; l < shared.length; l++) {
          const left = vLines[shared[k]]
          const right = vLines[shared[l]]
          const width = right.x - left.x
          const height = bottom.y - top.y
          if (width > 10 && height > 10) {
            rects.push({ x: left.x, y: top.y, width, height })
          }
        }
      }
    }
  }

  return deduplicateRects(rects)
}

function deduplicateRects(rects: PixelRect[]): PixelRect[] {
  const unique: PixelRect[] = []
  for (const rect of rects) {
    const isDuplicate = unique.some(
      (uniqueRect) =>
        Math.abs(uniqueRect.x - rect.x) <= DUPLICATE_TOLERANCE &&
        Math.abs(uniqueRect.y - rect.y) <= DUPLICATE_TOLERANCE &&
        Math.abs(uniqueRect.width - rect.width) <= DUPLICATE_TOLERANCE &&
        Math.abs(uniqueRect.height - rect.height) <= DUPLICATE_TOLERANCE
    )
    if (!isDuplicate) {
      unique.push(rect)
    }
  }
  return unique
}

// --- フィルタリング ---

function filterRects(
  rects: DetectedRectResult[],
  minWidth: number,
  minHeight: number
): DetectedRectResult[] {
  let filtered = rects.filter(
    (rect) => rect.width >= minWidth && rect.height >= minHeight
  )
  filtered = removeOverlappingLarger(filtered)
  return filtered
}

function removeOverlappingLarger(
  rects: DetectedRectResult[]
): DetectedRectResult[] {
  const toRemove = new Set<number>()
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const rectA = rects[i]
      const rectB = rects[j]
      const ix1 = Math.max(rectA.x, rectB.x)
      const iy1 = Math.max(rectA.y, rectB.y)
      const ix2 = Math.min(rectA.x + rectA.width, rectB.x + rectB.width)
      const iy2 = Math.min(rectA.y + rectA.height, rectB.y + rectB.height)
      if (ix2 <= ix1 || iy2 <= iy1) continue
      const intersection = (ix2 - ix1) * (iy2 - iy1)
      const areaA = rectA.width * rectA.height
      const areaB = rectB.width * rectB.height
      const smallerArea = Math.min(areaA, areaB)
      const largerIdx = areaA < areaB ? j : i
      const smallerNonOverlap = smallerArea - intersection
      if (smallerNonOverlap < intersection) {
        toRemove.add(largerIdx)
      }
    }
  }
  return rects.filter((_, i) => !toRemove.has(i))
}

// --- メインパイプライン ---

function detectRects(
  imageData: Uint8ClampedArray,
  w: number,
  h: number,
  settings: DetectionRequest["settings"]
): DetectedRectResult[] {
  const refDim = Math.max(w, h)
  const params = getSensitivityParams(settings.sensitivity, refDim)

  const gray = toGrayscale(imageData, w * h)
  const binary = adaptiveBinarize(gray, params.thresholdFactor)

  let processed = binary
  for (let i = 0; i < params.dilationIterations; i++) {
    processed = dilate(processed, w, h)
  }

  // 線検出
  let horizontalLines = detectHorizontalLines(
    processed,
    w,
    h,
    params.lineGapTolerance,
    params.lineMergeTolerance
  )
  let verticalLines = detectVerticalLines(
    processed,
    w,
    h,
    params.lineGapTolerance,
    params.lineMergeTolerance
  )

  // 画像端の偽線を除外
  const hMargin = h * EDGE_MARGIN_RATIO
  const wMargin = w * EDGE_MARGIN_RATIO
  horizontalLines = horizontalLines.filter(
    (line) => line.y > hMargin && line.y < h - hMargin
  )
  verticalLines = verticalLines.filter(
    (line) => line.x > wMargin && line.x < w - wMargin
  )

  // 線延長
  const maxEdge = Math.max(w, h)
  const extensionScale =
    maxEdge < MAX_PROCESSING_EDGE ? 1 : maxEdge / MAX_PROCESSING_EDGE
  const extension = Math.round((settings.lineExtension ?? 0) / extensionScale)
  if (extension > 0) {
    horizontalLines = horizontalLines.map((line) => ({
      y: line.y,
      x1: Math.max(0, line.x1 - extension),
      x2: Math.min(w - 1, line.x2 + extension),
    }))
    verticalLines = verticalLines.map((line) => ({
      x: line.x,
      y1: Math.max(0, line.y1 - extension),
      y2: Math.min(h - 1, line.y2 + extension),
    }))
  }

  // 線数が多すぎる場合は長い線を優先（短い線はノイズの可能性が高い）
  if (horizontalLines.length > MAX_LINES_FOR_RECT_BUILD) {
    horizontalLines.sort(
      (lineA, lineB) => lineB.x2 - lineB.x1 - (lineA.x2 - lineA.x1)
    )
    horizontalLines = horizontalLines.slice(0, MAX_LINES_FOR_RECT_BUILD)
  }
  if (verticalLines.length > MAX_LINES_FOR_RECT_BUILD) {
    verticalLines.sort(
      (lineA, lineB) => lineB.y2 - lineB.y1 - (lineA.y2 - lineA.y1)
    )
    verticalLines = verticalLines.slice(0, MAX_LINES_FOR_RECT_BUILD)
  }

  // 矩形構築
  const candidateRects = buildRectsFromLines(
    horizontalLines,
    verticalLines,
    params.intersectionTolerance
  )

  // 正規化
  const normalized: DetectedRectResult[] = candidateRects.map((rect) => ({
    x: rect.x / w,
    y: rect.y / h,
    width: rect.width / w,
    height: rect.height / h,
    confidence: 1,
  }))

  return filterRects(normalized, settings.minWidth, settings.minHeight)
}

// --- Worker メッセージハンドラ ---

self.onmessage = (event: MessageEvent<DetectionRequest>) => {
  const { imageBuffer, width, height, settings } = event.data
  const imageData = new Uint8ClampedArray(imageBuffer)
  const rects = detectRects(imageData, width, height, settings)
  const response: DetectionResponse = { type: "result", rects }
  self.postMessage(response)
}
