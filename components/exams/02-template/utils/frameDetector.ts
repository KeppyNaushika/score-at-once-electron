/**
 * 採点枠検出アルゴリズム
 *
 * 印刷された答案用紙の枠線（黒い罫線）を自動検出し、
 * 採点領域として使用可能な矩形座標を返す。
 *
 * ## 処理フロー
 *
 * 1. **前処理**: グレースケール変換 → Sobelエッジ検出 → 二値化
 *    - RGB画像を輝度値に変換し、エッジ（輪郭）を強調
 *    - 閾値128で二値化し、線分を抽出
 *
 * 2. **線検出**: 水平線・垂直線を走査して検出
 *    - 連続する白ピクセル（エッジ）を線分として認識
 *    - 最小長（画像サイズの2%）未満の線は除外
 *    - 近接する線分（3px以内）をマージして1本に統合
 *
 * 3. **線延長**: ユーザー指定のピクセル分だけ線を延長
 *    - 途切れた枠線を補完し、閉じた矩形を形成しやすくする
 *
 * 4. **矩形構築**: 4本の線（上下左右）の交点から矩形を生成
 *    - 水平線ペア × 垂直線ペアの組み合わせを全探索
 *    - 4つの交点が成立する場合のみ矩形として採用
 *
 * 5. **フィルタリング**:
 *    - 最小幅・最小高さ未満の矩形を除外
 *    - 重複する矩形のうち、内包関係にある大きい方を除外
 *      （例: 「日」のような入れ子構造で外枠を除去）
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

/** 線マージの許容ピクセル */
const LINE_MERGE_TOLERANCE = 3

/** 交点判定の許容ピクセル */
const INTERSECTION_TOLERANCE = 5

/** 重複判定の許容ピクセル */
const DUPLICATE_TOLERANCE = 5

/** 最小線長（画像サイズの2%） */
const MIN_LINE_LENGTH_RATIO = 0.02

/** 二値化の閾値 */
const BINARIZE_THRESHOLD = 128

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
   *
   * @param canvas - 画像が描画されたCanvas要素
   * @param settings - 検出設定（線延長、最小幅、最小高さ）
   * @returns 検出された矩形の配列（相対座標0-1）
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

    // Step 1: グレースケール変換
    // RGB値を輝度値に変換（ITU-R BT.709準拠）
    const gray = this.toGrayscale()

    // Step 2: エッジ検出（Sobel）
    // 輝度の急激な変化（=線の境界）を検出
    const edges = this.detectEdges(gray)

    // Step 3: 二値化
    // エッジ強度を閾値で白黒に分離
    const binary = this.binarize(edges, BINARIZE_THRESHOLD)

    // Step 4: 線検出 → 延長 → 矩形構築
    // 水平・垂直線を検出し、4線の交点から矩形を生成
    const rects = this.findRectangles(binary)

    // Step 5: フィルタリング
    // サイズ制約と重複除去を適用
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
   * Sobelフィルタによるエッジ検出
   * 3x3カーネルで水平・垂直方向の勾配を計算し、勾配強度を出力
   * 黒い線の両端（白→黒、黒→白の境界）が白く検出される
   */
  private detectEdges(gray: Uint8ClampedArray): Uint8ClampedArray {
    const edges = new Uint8ClampedArray(this.width * this.height)
    const w = this.width
    const h = this.height

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x

        const tl = gray[(y - 1) * w + (x - 1)]
        const t = gray[(y - 1) * w + x]
        const tr = gray[(y - 1) * w + (x + 1)]
        const l = gray[y * w + (x - 1)]
        const r = gray[y * w + (x + 1)]
        const bl = gray[(y + 1) * w + (x - 1)]
        const b = gray[(y + 1) * w + x]
        const br = gray[(y + 1) * w + (x + 1)]

        const gx = -tl + tr - 2 * l + 2 * r - bl + br
        const gy = -tl - 2 * t - tr + bl + 2 * b + br
        const magnitude = Math.sqrt(gx * gx + gy * gy)
        edges[idx] = Math.min(255, magnitude)
      }
    }

    return edges
  }

  /**
   * 二値化
   */
  private binarize(
    edges: Uint8ClampedArray,
    threshold: number
  ): Uint8ClampedArray {
    const binary = new Uint8ClampedArray(edges.length)
    for (let i = 0; i < edges.length; i++) {
      binary[i] = edges[i] > threshold ? 255 : 0
    }
    return binary
  }

  /**
   * 矩形を検出
   * 水平線・垂直線を検出し、ユーザー指定分延長した後、
   * 4線が交差する組み合わせを矩形として出力
   */
  private findRectangles(binary: Uint8ClampedArray): DetectedRect[] {
    const w = this.width
    const h = this.height
    const rects: DetectedRect[] = []

    // 水平線と垂直線を検出
    let horizontalLines = this.detectHorizontalLines(binary)
    let verticalLines = this.detectVerticalLines(binary)

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
      verticalLines
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
   * 水平線を検出
   */
  private detectHorizontalLines(binary: Uint8ClampedArray): HLine[] {
    const lines: HLine[] = []
    const w = this.width
    const h = this.height
    const minLength = Math.floor(w * MIN_LINE_LENGTH_RATIO)

    for (let y = 0; y < h; y++) {
      let lineStart = -1
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (binary[idx] === 255) {
          if (lineStart === -1) lineStart = x
        } else {
          if (lineStart !== -1 && x - lineStart >= minLength) {
            lines.push({ y, x1: lineStart, x2: x - 1 })
          }
          lineStart = -1
        }
      }
      if (lineStart !== -1 && w - lineStart >= minLength) {
        lines.push({ y, x1: lineStart, x2: w - 1 })
      }
    }

    return this.mergeLines(lines, "horizontal")
  }

  /**
   * 垂直線を検出
   */
  private detectVerticalLines(binary: Uint8ClampedArray): VLine[] {
    const lines: VLine[] = []
    const w = this.width
    const h = this.height
    const minLength = Math.floor(h * MIN_LINE_LENGTH_RATIO)

    for (let x = 0; x < w; x++) {
      let lineStart = -1
      for (let y = 0; y < h; y++) {
        const idx = y * w + x
        if (binary[idx] === 255) {
          if (lineStart === -1) lineStart = y
        } else {
          if (lineStart !== -1 && y - lineStart >= minLength) {
            lines.push({ x, y1: lineStart, y2: y - 1 })
          }
          lineStart = -1
        }
      }
      if (lineStart !== -1 && h - lineStart >= minLength) {
        lines.push({ x, y1: lineStart, y2: h - 1 })
      }
    }

    return this.mergeLines(lines, "vertical")
  }

  /**
   * 近接する線をマージ
   */
  private mergeLines<T extends HLine | VLine>(
    lines: T[],
    direction: "horizontal" | "vertical"
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
          Math.abs(last.y - line.y) <= LINE_MERGE_TOLERANCE &&
          line.x1 <= last.x2 + LINE_MERGE_TOLERANCE
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
          Math.abs(last.x - line.x) <= LINE_MERGE_TOLERANCE &&
          line.y1 <= last.y2 + LINE_MERGE_TOLERANCE
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
  private buildRectsFromLines(hLines: HLine[], vLines: VLine[]): PixelRect[] {
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
              this.linesIntersect(top, left) &&
              this.linesIntersect(top, right) &&
              this.linesIntersect(bottom, left) &&
              this.linesIntersect(bottom, right)
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
  private linesIntersect(hLine: HLine, vLine: VLine): boolean {
    return (
      vLine.x >= hLine.x1 - INTERSECTION_TOLERANCE &&
      vLine.x <= hLine.x2 + INTERSECTION_TOLERANCE &&
      hLine.y >= vLine.y1 - INTERSECTION_TOLERANCE &&
      hLine.y <= vLine.y2 + INTERSECTION_TOLERANCE
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
   *
   * ロジック:
   * - 2つの矩形A, B（A < B）が重なっている場合
   * - Aのはみ出し部分 = A の面積 - 共通部分の面積
   * - はみ出し部分 < 共通部分 なら、AはほぼBに含まれているとみなしBを除外
   *
   * 例: 「日」のような入れ子構造
   * - 内側の2つの矩形と外側の大枠が検出される
   * - 内側の矩形は外側にほぼ含まれるため、外側が除外される
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

          // 小さい方の面積と大きい方の矩形を特定
          const smallerArea = Math.min(areaA, areaB)
          const larger = areaA < areaB ? b : a

          // 小さい方のはみ出し部分 = 小さい方の面積 - 共通部分
          const smallerNonOverlap = smallerArea - intersection

          // はみ出し < 共通部分 なら、大きい方を除外
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
export const frameDetector = new FrameDetector()
