/**
 * 答案画像の補正エンジン
 *
 * マスター画像のコーナーマーカー位置を基準に、
 * 答案画像のズレ・傾き・拡大縮小を類似変換で補正する。
 */

import sharp from "sharp"

import type {
  DetectedCornerMarker,
  MarkerDetectionResult,
  Point,
} from "../../../types/omr.types"
import { detectCornerMarkersFromRaw } from "./cornerMarkerDetector"
import { loadImageRawFromBuffer } from "./imageProcessor"

export interface SimilarityTransformParams {
  a: number // cos(θ) * scale
  b: number // sin(θ) * scale
  tx: number // x平行移動
  ty: number // y平行移動
}

export interface ImageCorrectionResult {
  success: boolean
  correctedBuffer?: Buffer
  error?: string
  /** 算出されたスケール係数 */
  scale?: number
  /** 算出された回転角(度) */
  rotationDeg?: number
}

/**
 * 4点ペアから最小二乗法で類似変換パラメータを算出
 *
 * 類似変換: X = a*x - b*y + tx, Y = b*x + a*y + ty
 * 4点(8方程式)で4未知数(a, b, tx, ty)を解く
 */
export function computeSimilarityTransform(
  src: Point[],
  dst: Point[]
): SimilarityTransformParams {
  if (src.length !== dst.length || src.length < 2) {
    throw new Error("src と dst は同数かつ2点以上必要です")
  }

  const n = src.length

  // 正規方程式の係数を蓄積
  // [a, b, tx, ty] を解く
  // X_i = a * x_i - b * y_i + tx
  // Y_i = b * x_i + a * y_i + ty
  let sumXx = 0,
    sumXy = 0,
    sumX = 0,
    sumY = 0
  let sumXX = 0,
    sumXY_dst = 0,
    sumYY_dst = 0

  for (let i = 0; i < n; i++) {
    const { x, y } = src[i]
    const { x: X, y: Y } = dst[i]

    sumXx += x * X + y * Y
    sumXy += x * Y - y * X
    sumX += X
    sumY += Y
    sumXX += x * x + y * y
    sumXY_dst += x
    sumYY_dst += y
  }

  // 4x4の正規方程式を解く
  // | sumXX    0     sumXY_dst  sumYY_dst | | a  |   | sumXx |
  // |   0    sumXX  -sumYY_dst  sumXY_dst | | b  | = | sumXy |
  // | sumXY_dst -sumYY_dst  n      0      | | tx |   | sumX  |
  // | sumYY_dst  sumXY_dst  0      n      | | ty |   | sumY  |

  // 解析解（ブロック行列の逆行列を利用）
  const det = n * sumXX - sumXY_dst * sumXY_dst - sumYY_dst * sumYY_dst
  if (Math.abs(det) < 1e-10) {
    throw new Error("変換パラメータの算出に失敗しました（退化した入力）")
  }

  const a = (n * sumXx - sumXY_dst * sumX - sumYY_dst * sumY) / det
  const b = (n * sumXy + sumYY_dst * sumX - sumXY_dst * sumY) / det
  const tx = (sumX - a * sumXY_dst + b * sumYY_dst) / n
  const ty = (sumY - b * sumXY_dst - a * sumYY_dst) / n

  return { a, b, tx, ty }
}

/**
 * 答案画像をマスター画像のマーカー位置に合わせて補正
 */
export async function correctImage(
  imageBuffer: Buffer,
  masterMarkers: DetectedCornerMarker[],
  masterWidth: number,
  masterHeight: number,
  colorThreshold: number = 128
): Promise<ImageCorrectionResult> {
  try {
    // 1. 答案画像のマーカー検出
    const rawImage = await loadImageRawFromBuffer(imageBuffer)
    const answerResult: MarkerDetectionResult = detectCornerMarkersFromRaw(
      rawImage,
      colorThreshold
    )

    if (!answerResult.success) {
      return {
        success: false,
        error: `答案マーカー検出失敗: ${answerResult.error ?? `${answerResult.markers.length}/4検出`}`,
      }
    }

    // 2. マーカーをコーナー順にソート (TL, TR, BL, BR)
    const cornerOrder: Array<"TL" | "TR" | "BL" | "BR"> = [
      "TL",
      "TR",
      "BL",
      "BR",
    ]
    const srcPoints: Point[] = []
    const dstPoints: Point[] = []

    for (const corner of cornerOrder) {
      const answerMarker = answerResult.markers.find((m) => m.corner === corner)
      const masterMarker = masterMarkers.find((m) => m.corner === corner)

      if (!answerMarker || !masterMarker) {
        return {
          success: false,
          error: `${corner}マーカーのペアリングに失敗`,
        }
      }

      srcPoints.push({ x: answerMarker.centerX, y: answerMarker.centerY })
      dstPoints.push({ x: masterMarker.centerX, y: masterMarker.centerY })
    }

    // 3. 類似変換パラメータ算出
    const params = computeSimilarityTransform(srcPoints, dstPoints)
    const scale = Math.sqrt(params.a * params.a + params.b * params.b)
    const rotationDeg = (Math.atan2(params.b, params.a) * 180) / Math.PI

    // 4. スケール妥当性検証
    if (scale < 0.8 || scale > 1.2) {
      return {
        success: false,
        error: `スケール係数 ${scale.toFixed(3)} が許容範囲外(0.8〜1.2)`,
        scale,
        rotationDeg,
      }
    }

    // 5. sharp.affine() で画像変換
    // affine の matrix は [[a, -b], [b, a]] (答案→マスター座標系)
    const correctedBuffer = await sharp(imageBuffer)
      .affine(
        [
          [params.a, -params.b],
          [params.b, params.a],
        ],
        {
          odx: params.tx,
          ody: params.ty,
          background: "#FFFFFF",
        }
      )
      .resize(masterWidth, masterHeight)
      .png()
      .toBuffer()

    return {
      success: true,
      correctedBuffer,
      scale,
      rotationDeg,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "画像補正中に不明なエラーが発生",
    }
  }
}
