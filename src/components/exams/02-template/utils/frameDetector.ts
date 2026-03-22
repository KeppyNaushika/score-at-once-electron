/**
 * 採点枠検出アルゴリズム
 *
 * 印刷された答案用紙の枠線（黒い罫線）を自動検出し、
 * 採点領域として使用可能な矩形座標を返す。
 *
 * ## 処理フロー
 *
 * 1. **前処理**: グレースケール変換 → 適応的二値化（黒線を白に反転）
 *    - RGB画像を輝度値に変換
 *    - Otsu法で最適閾値を自動決定し、黒い線を白ピクセルとして抽出
 *
 * 2. **モルフォロジー処理**: 膨張（dilation）で途切れた線のギャップを補完
 *
 * 3. **線検出**: 水平線・垂直線を走査して検出（ギャップ許容）
 *    - 一定のギャップ（感度に応じて可変）を許容して線分を認識
 *    - 近接する線分をマージして1本に統合
 *
 * 4. **線延長**: ユーザー指定のピクセル分だけ線を延長
 *
 * 5. **矩形構築**: 4本の線（上下左右）の交点から矩形を生成
 *
 * 6. **フィルタリング**: サイズ制約と重複除去
 *
 * ## 座標系
 * - 入力: ピクセル座標（画像サイズ依存）
 * - 出力: 相対座標（0-1、画像サイズ非依存）
 */

import { DetectedRect, DetectionSettings } from "../types"
import { generateId } from "./rectUtils"

/** 水平線 */
type HLine = { y: number; x1: number; x2: number }

/** 垂直線 */
type VLine = { x: number; y1: number; y2: number }

/** ピクセル座標の矩形 */
type PixelRect = { x: number; y: number; width: number; height: number }

/** 重複判定の許容ピクセル */
const DUPLICATE_TOLERANCE = 5

/** 最小線長（画像サイズの2%） */
const MIN_LINE_LENGTH_RATIO = 0.02

/**
 * 感度レベル（1-5）に応じたパラメータ
 */
/** 感度レベル（1〜5）に応じた二値化・線検出パラメータを返す */
function getSensitivityParams(sensitivity: number) {
  // sensitivity: 1(低感度) ～ 5(高感度)
  const s = Math.max(1, Math.min(5, sensitivity))

  return {
    /** 二値化閾値の補正係数（Otsu閾値に掛ける。低いほど薄い線も拾う） */
    thresholdFactor: [1.0, 0.85, 0.7, 0.55, 0.4][s - 1],
    /** 膨張回数 */
    dilationIterations: [0, 1, 1, 2, 2][s - 1],
    /** 線検出時に許容するギャップ（ピクセル） */
    lineGapTolerance: [1, 3, 5, 8, 12][s - 1],
    /** 線マージの許容ピクセル */
    lineMergeTolerance: [3, 5, 6, 8, 10][s - 1],
    /** 交点判定の許容ピクセル */
    intersectionTolerance: [5, 7, 8, 10, 12][s - 1],
  }
}

/**
 * 枠検出クラス
 */
export class FrameDetector {
  private imageData: ImageData | null = null
  private width = 0
  private height = 0
  private settings: DetectionSettings | null = null

  /**
   * 画像URLから検出を実行
   */
  async detectFromUrl(
    imageUrl: string,
    settings: DetectionSettings
  ): Promise<DetectedRect[]> {
    const canvas = await this.loadImageToCanvas(imageUrl)
    return this.detect(canvas, settings)
  }

  /**
   * 画像をCanvasにロード
   */
  private async loadImageToCanvas(
    imageUrl: string
  ): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Failed to get canvas context"))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas)
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = imageUrl
    })
  }

  /**
   * Canvasから枠を検出
   */
  detect(
    canvas: HTMLCanvasElement,
    settings: DetectionSettings
  ): DetectedRect[] {
    const ctx = canvas.getContext("2d")
    if (!ctx) return []

    this.width = canvas.width
    this.height = canvas.height
    this.settings = settings
    this.imageData = ctx.getImageData(0, 0, this.width, this.height)

    const params = getSensitivityParams(settings.sensitivity)

    // Step 1: グレースケール変換
    const gray = this.toGrayscale()

    // Step 2: 適応的二値化（黒い線 → 白ピクセル）
    const binary = this.adaptiveBinarize(gray, params.thresholdFactor)

    // Step 3: 膨張処理（途切れた線のギャップを補完）
    let processed = binary
    for (let i = 0; i < params.dilationIterations; i++) {
      processed = this.dilate(processed)
    }

    // Step 4: 線検出 → 延長 → 矩形構築
    const rects = this.findRectangles(processed, params)

    // Step 5: フィルタリング
    return this.filterRects(rects, settings)
  }

  /**
   * グレースケール変換
   * ITU-R BT.709の輝度係数を使用: Y = 0.2126R + 0.7152G + 0.0722B
   */
  private toGrayscale(): Uint8ClampedArray {
    const gray = new Uint8ClampedArray(this.width * this.height)
    const data = this.imageData!.data

    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4
      gray[i] = Math.round(
        data[idx] * 0.2126 + data[idx + 1] * 0.7152 + data[idx + 2] * 0.0722
      )
    }
    return gray
  }

  /**
   * Otsu法による最適閾値の計算
   * 画像のヒストグラムからクラス間分散を最大化する閾値を自動決定
   */
  private computeOtsuThreshold(gray: Uint8ClampedArray): number {
    // ヒストグラム作成
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

      const variance =
        weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg)

      if (variance > maxVariance) {
        maxVariance = variance
        bestThreshold = t
      }
    }

    return bestThreshold
  }

  /**
   * 適応的二値化（黒い線を白ピクセルとして抽出）
   *
   * Sobelエッジ検出ではなく、直接的にグレースケール値を閾値処理。
   * 黒い線（低輝度）を検出するため、閾値以下を白(255)、以上を黒(0)に反転。
   */
  private adaptiveBinarize(
    gray: Uint8ClampedArray,
    thresholdFactor: number
  ): Uint8ClampedArray {
    const binary = new Uint8ClampedArray(gray.length)

    // Otsu法で最適閾値を計算し、感度係数で調整
    const otsuThreshold = this.computeOtsuThreshold(gray)
    const threshold = Math.min(255, Math.round(otsuThreshold * thresholdFactor))

    // 閾値以下（暗い=線）→ 白(255)、閾値超（明るい=背景）→ 黒(0)
    for (let i = 0; i < gray.length; i++) {
      binary[i] = gray[i] <= threshold ? 255 : 0
    }

    return binary
  }

  /**
   * 3x3カーネルによる膨張処理
   * 近傍に1つでも白ピクセルがあれば白にする
   * 途切れた線のギャップを埋める効果がある
   */
  private dilate(binary: Uint8ClampedArray): Uint8ClampedArray {
    const result = new Uint8ClampedArray(binary.length)
    const w = this.width
    const h = this.height

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let hasWhite = false
        // 3x3近傍を走査
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

  /**
   * 矩形を検出
   */
  private findRectangles(
    binary: Uint8ClampedArray,
    params: ReturnType<typeof getSensitivityParams>
  ): DetectedRect[] {
    const w = this.width
    const h = this.height
    const rects: DetectedRect[] = []

    // 水平線と垂直線を検出（ギャップ許容）
    let horizontalLines = this.detectHorizontalLines(
      binary,
      params.lineGapTolerance,
      params.lineMergeTolerance
    )
    let verticalLines = this.detectVerticalLines(
      binary,
      params.lineGapTolerance,
      params.lineMergeTolerance
    )

    // 線を延長（設定されている場合）
    const extension = this.settings?.lineExtension ?? 0
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

    // 線の交点から矩形を構築
    const candidateRects = this.buildRectsFromLines(
      horizontalLines,
      verticalLines,
      params.intersectionTolerance
    )

    for (const rect of candidateRects) {
      const normalizedRect: DetectedRect = {
        id: generateId(),
        x: rect.x / w,
        y: rect.y / h,
        width: rect.width / w,
        height: rect.height / h,
        confidence: 1,
      }
      rects.push(normalizedRect)
    }

    return rects
  }

  /**
   * 水平線を検出（ギャップ許容）
   *
   * 連続する白ピクセルだけでなく、一定のギャップ（gapTolerance）を
   * 許容して線分として認識する。スキャンによるかすれ対応。
   */
  private detectHorizontalLines(
    binary: Uint8ClampedArray,
    gapTolerance: number,
    mergeTolerance: number
  ): HLine[] {
    const lines: HLine[] = []
    const w = this.width
    const h = this.height
    const minLength = Math.floor(w * MIN_LINE_LENGTH_RATIO)

    for (let y = 0; y < h; y++) {
      let lineStart = -1
      let gapCount = 0

      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (binary[idx] === 255) {
          if (lineStart === -1) lineStart = x
          gapCount = 0
        } else {
          if (lineStart !== -1) {
            gapCount++
            if (gapCount > gapTolerance) {
              // ギャップ超過 → 線を確定
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
      // 行末処理
      if (lineStart !== -1) {
        const lineEnd = gapCount > 0 ? w - 1 - gapCount : w - 1
        if (lineEnd - lineStart >= minLength) {
          lines.push({ y, x1: lineStart, x2: lineEnd })
        }
      }
    }

    return this.mergeLines(lines, "horizontal", mergeTolerance)
  }

  /**
   * 垂直線を検出（ギャップ許容）
   */
  private detectVerticalLines(
    binary: Uint8ClampedArray,
    gapTolerance: number,
    mergeTolerance: number
  ): VLine[] {
    const lines: VLine[] = []
    const w = this.width
    const h = this.height
    const minLength = Math.floor(h * MIN_LINE_LENGTH_RATIO)

    for (let x = 0; x < w; x++) {
      let lineStart = -1
      let gapCount = 0

      for (let y = 0; y < h; y++) {
        const idx = y * w + x
        if (binary[idx] === 255) {
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

    return this.mergeLines(lines, "vertical", mergeTolerance)
  }

  /**
   * 近接する線をマージ
   */
  private mergeLines<T extends HLine | VLine>(
    lines: T[],
    direction: "horizontal" | "vertical",
    mergeTolerance: number
  ): T[] {
    if (lines.length === 0) return []

    const merged: T[] = []

    if (direction === "horizontal") {
      const hLines = lines as HLine[]
      hLines.sort((a, b) => a.y - b.y || a.x1 - b.x1)

      for (const line of hLines) {
        const last = merged[merged.length - 1] as HLine | undefined
        if (
          last &&
          Math.abs(last.y - line.y) <= mergeTolerance &&
          line.x1 <= last.x2 + mergeTolerance
        ) {
          last.x2 = Math.max(last.x2, line.x2)
        } else {
          merged.push({ ...line } as T)
        }
      }
    } else {
      const vLines = lines as VLine[]
      vLines.sort((a, b) => a.x - b.x || a.y1 - b.y1)

      for (const line of vLines) {
        const last = merged[merged.length - 1] as VLine | undefined
        if (
          last &&
          Math.abs(last.x - line.x) <= mergeTolerance &&
          line.y1 <= last.y2 + mergeTolerance
        ) {
          last.y2 = Math.max(last.y2, line.y2)
        } else {
          merged.push({ ...line } as T)
        }
      }
    }

    return merged
  }

  /**
   * 水平線と垂直線から矩形を構築
   */
  private buildRectsFromLines(
    hLines: HLine[],
    vLines: VLine[],
    intersectionTolerance: number
  ): PixelRect[] {
    const rects: PixelRect[] = []

    for (let i = 0; i < hLines.length; i++) {
      for (let j = i + 1; j < hLines.length; j++) {
        const top = hLines[i]
        const bottom = hLines[j]

        // 上下の線がオーバーラップしているか
        const overlapX1 = Math.max(top.x1, bottom.x1)
        const overlapX2 = Math.min(top.x2, bottom.x2)
        if (overlapX2 - overlapX1 < 10) continue

        for (let k = 0; k < vLines.length; k++) {
          for (let l = k + 1; l < vLines.length; l++) {
            const left = vLines[k]
            const right = vLines[l]

            // 4つの線が交差するか
            if (
              this.linesIntersect(top, left, intersectionTolerance) &&
              this.linesIntersect(top, right, intersectionTolerance) &&
              this.linesIntersect(bottom, left, intersectionTolerance) &&
              this.linesIntersect(bottom, right, intersectionTolerance)
            ) {
              const x = left.x
              const y = top.y
              const width = right.x - left.x
              const height = bottom.y - top.y

              if (width > 10 && height > 10) {
                rects.push({ x, y, width, height })
              }
            }
          }
        }
      }
    }

    return this.deduplicateRects(rects)
  }

  /**
   * 水平線と垂直線が交わるか判定
   */
  private linesIntersect(
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

  /**
   * 重複する矩形を除去
   */
  private deduplicateRects(rects: PixelRect[]): PixelRect[] {
    const unique: PixelRect[] = []

    for (const rect of rects) {
      const isDuplicate = unique.some(
        (r) =>
          Math.abs(r.x - rect.x) <= DUPLICATE_TOLERANCE &&
          Math.abs(r.y - rect.y) <= DUPLICATE_TOLERANCE &&
          Math.abs(r.width - rect.width) <= DUPLICATE_TOLERANCE &&
          Math.abs(r.height - rect.height) <= DUPLICATE_TOLERANCE
      )
      if (!isDuplicate) {
        unique.push(rect)
      }
    }

    return unique
  }

  /**
   * サイズでフィルタリング
   */
  private filterRects(
    rects: DetectedRect[],
    settings: DetectionSettings
  ): DetectedRect[] {
    // 1. 最小サイズでフィルタ
    let filtered = rects.filter((rect) => {
      return (
        rect.width >= settings.minWidth && rect.height >= settings.minHeight
      )
    })

    // 2. 重なっている場合、大きい方を除外
    filtered = this.removeOverlappingLarger(filtered)

    return filtered
  }

  /**
   * 重なっている矩形のうち、内包関係にある大きい方を除外
   */
  private removeOverlappingLarger(rects: DetectedRect[]): DetectedRect[] {
    const toRemove = new Set<string>()

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]

        const intersection = this.getIntersectionArea(a, b)
        if (intersection > 0) {
          const areaA = a.width * a.height
          const areaB = b.width * b.height

          const smallerArea = Math.min(areaA, areaB)
          const larger = areaA < areaB ? b : a

          const smallerNonOverlap = smallerArea - intersection

          if (smallerNonOverlap < intersection) {
            toRemove.add(larger.id)
          }
        }
      }
    }

    return rects.filter((rect) => !toRemove.has(rect.id))
  }

  /**
   * 2つの矩形の共通部分の面積を計算
   */
  private getIntersectionArea(a: DetectedRect, b: DetectedRect): number {
    const x1 = Math.max(a.x, b.x)
    const y1 = Math.max(a.y, b.y)
    const x2 = Math.min(a.x + a.width, b.x + b.width)
    const y2 = Math.min(a.y + a.height, b.y + b.height)

    if (x2 <= x1 || y2 <= y1) {
      return 0
    }

    return (x2 - x1) * (y2 - y1)
  }
}

/**
 * シングルトンインスタンス
 */
/** FrameDetectorのシングルトンインスタンス */
export const frameDetector = new FrameDetector()
