/**
 * 答案画像の補正エンジン
 *
 * マスター画像のコーナーマーカー位置を基準に、
 * 答案画像のズレ・傾きを補正する。
 *
 * 処理順序:
 * 1. 回転補正（画像中心を基点にsharp.rotateで回転）
 * 2. 平行移動補正（extractの位置をオフセットして切り出し）
 * 3. スケール補正（画像中心を基点にresizeしてから中央をクロップ）
 */

import sharp from "sharp"

import type {
  DetectedCornerMarker,
  MarkerDetectionResult,
  Point,
} from "../../../src/types/omr.types"
import { detectCornerMarkersFromRaw } from "./cornerMarkerDetector"
import { loadImageRawFromBuffer } from "./imageProcessor"

export interface RigidTransformParams {
  cosTheta: number
  sinTheta: number
  tx: number // x平行移動
  ty: number // y平行移動
}

export interface ImageCorrectionResult {
  success: boolean
  correctedBuffer?: Buffer
  error?: string
  /** 算出された回転角(度) */
  rotationDeg?: number
  /** 算出された平行移動量(px) */
  translation?: { tx: number; ty: number }
  /** 算出されたスケール係数 */
  scale?: number
}

/**
 * 4点ペアから最小二乗法で剛体変換パラメータを算出
 *
 * 剛体変換: X = cos(θ)*x - sin(θ)*y + tx, Y = sin(θ)*x + cos(θ)*y + ty
 * スケールは含まない（回転 + 平行移動のみ）
 */
function computeRigidTransform(
  src: Point[],
  dst: Point[]
): RigidTransformParams {
  if (src.length !== dst.length || src.length < 2) {
    throw new Error("src と dst は同数かつ2点以上必要です")
  }

  const n = src.length

  // 重心を計算
  let srcCx = 0,
    srcCy = 0,
    dstCx = 0,
    dstCy = 0
  for (let i = 0; i < n; i++) {
    srcCx += src[i].x
    srcCy += src[i].y
    dstCx += dst[i].x
    dstCy += dst[i].y
  }
  srcCx /= n
  srcCy /= n
  dstCx /= n
  dstCy /= n

  // 重心を原点にした座標で回転角を計算
  let sumCross = 0 // Σ(sx*dy - sy*dx)
  let sumDot = 0 // Σ(sx*dx + sy*dy)
  for (let i = 0; i < n; i++) {
    const sx = src[i].x - srcCx
    const sy = src[i].y - srcCy
    const dx = dst[i].x - dstCx
    const dy = dst[i].y - dstCy
    sumCross += sx * dy - sy * dx
    sumDot += sx * dx + sy * dy
  }

  const theta = Math.atan2(sumCross, sumDot)
  const cosTheta = Math.cos(theta)
  const sinTheta = Math.sin(theta)

  // 平行移動: dst_centroid = R * src_centroid + t
  const tx = dstCx - cosTheta * srcCx + sinTheta * srcCy
  const ty = dstCy - sinTheta * srcCx - cosTheta * srcCy

  return { cosTheta, sinTheta, tx, ty }
}

/**
 * マーカー重心間の距離比からスケール係数を算出
 */
function computeScaleFactor(src: Point[], dst: Point[]): number {
  const n = src.length

  let srcCx = 0,
    srcCy = 0,
    dstCx = 0,
    dstCy = 0
  for (let i = 0; i < n; i++) {
    srcCx += src[i].x
    srcCy += src[i].y
    dstCx += dst[i].x
    dstCy += dst[i].y
  }
  srcCx /= n
  srcCy /= n
  dstCx /= n
  dstCy /= n

  let srcDistSum = 0
  let dstDistSum = 0
  for (let i = 0; i < n; i++) {
    srcDistSum += Math.sqrt((src[i].x - srcCx) ** 2 + (src[i].y - srcCy) ** 2)
    dstDistSum += Math.sqrt((dst[i].x - dstCx) ** 2 + (dst[i].y - dstCy) ** 2)
  }

  return dstDistSum / srcDistSum
}

/**
 * 白で拡張してから指定位置・サイズで切り出す
 * extractが画像外にはみ出しても安全に処理する
 */
async function safeExtract(
  buf: Buffer,
  imgW: number,
  imgH: number,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<Buffer> {
  // 必要な拡張量を計算
  const padLeft = Math.max(0, -left)
  const padTop = Math.max(0, -top)
  const padRight = Math.max(0, left + width - imgW)
  const padBottom = Math.max(0, top + height - imgH)

  const extractLeft = left + padLeft
  const extractTop = top + padTop

  // extend と extract を分けて実行（チェーン実行で失敗するケースを回避）
  let currentBuf = buf
  if (padLeft > 0 || padTop > 0 || padRight > 0 || padBottom > 0) {
    currentBuf = await sharp(currentBuf)
      .extend({
        top: padTop,
        bottom: padBottom,
        left: padLeft,
        right: padRight,
        background: { r: 255, g: 255, b: 255 },
      })
      .png()
      .toBuffer()
  }

  return sharp(currentBuf)
    .extract({ left: extractLeft, top: extractTop, width, height })
    .png()
    .toBuffer()
}

/**
 * 答案画像をマスター画像のマーカー位置に合わせて補正
 *
 * 1. 回転: sharp.rotate()で画像中心を基点に回転
 * 2. 平行移動: 回転後の画像から正しい位置をextractで切り出し
 * 3. スケール: 画像中心を基点にresizeしてから中央をクロップ
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

    // 2. マスターマーカー座標を答案画像サイズに正規化
    const W = rawImage.width
    const H = rawImage.height
    const scaleX = W / masterWidth
    const scaleY = H / masterHeight

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
      dstPoints.push({
        x: masterMarker.centerX * scaleX,
        y: masterMarker.centerY * scaleY,
      })
    }

    // 3. 剛体変換パラメータ算出（回転 + 平行移動）
    const rigid = computeRigidTransform(srcPoints, dstPoints)
    const rotationDeg =
      (Math.atan2(rigid.sinTheta, rigid.cosTheta) * 180) / Math.PI

    if (Math.abs(rotationDeg) > 5) {
      return {
        success: false,
        error: `回転角 ${rotationDeg.toFixed(2)}° が許容範囲外(±5°)`,
        rotationDeg,
      }
    }

    // 4. スケール係数算出
    const scale = computeScaleFactor(srcPoints, dstPoints)

    if (scale < 0.8 || scale > 1.2) {
      return {
        success: false,
        error: `スケール係数 ${scale.toFixed(3)} が許容範囲外(0.8〜1.2)`,
        rotationDeg,
        scale,
      }
    }

    // ================================================================
    // Step A: 回転補正（画像中心を基点）
    // ================================================================
    // sharp.rotate() は画像の中心を基点に回転する。
    // 剛体変換の回転角は原点基点で計算されているので、
    // 中心基点での平行移動に変換する。
    //
    // 原点基点: p' = R*p + t
    // 中心基点: p' = R*(p - c) + c + t_center
    //   → t_center = t + R*c - c
    //   → t_center_x = tx + (cosθ-1)*cx - sinθ*cy
    //   → t_center_y = ty + sinθ*cx + (cosθ-1)*cy
    const cx = W / 2
    const cy = H / 2
    const txCenter = rigid.tx + (rigid.cosTheta - 1) * cx - rigid.sinTheta * cy
    const tyCenter = rigid.ty + rigid.sinTheta * cx + (rigid.cosTheta - 1) * cy

    // sharp.rotate(angle): 正の値で反時計回り
    // 我々の回転角: srcをdstに合わせるための回転
    const rotated = await sharp(imageBuffer)
      .rotate(rotationDeg, { background: "#FFFFFF" })
      .png()
      .toBuffer()

    const rotMeta = await sharp(rotated).metadata()
    const rotW = rotMeta.width!
    const rotH = rotMeta.height!

    // ================================================================
    // Step B: 平行移動補正（回転後画像からextract）
    // ================================================================
    // 回転後の画像は元サイズより大きい（回転で角が出る分）。
    // 画像中心は回転しても回転後画像の中心にある。
    // 中心から (W/2, H/2) 戻ったところが元の(0,0)。
    // そこからtxCenter, tyCenterだけずらした位置がextract開始点。
    //
    // txCenter > 0 → コンテンツを右にずらす → extractを左にずらす
    const baseLeft = Math.round((rotW - W) / 2)
    const baseTop = Math.round((rotH - H) / 2)
    const extractLeft = baseLeft - Math.round(txCenter)
    const extractTop = baseTop - Math.round(tyCenter)

    const translated = await safeExtract(
      rotated,
      rotW,
      rotH,
      extractLeft,
      extractTop,
      W,
      H
    )

    // ================================================================
    // Step C: スケール補正（画像中心を基点にresize → 中央クロップ）
    // ================================================================
    let correctedBuffer: Buffer
    if (Math.abs(scale - 1.0) > 0.001) {
      // scale > 1: dstマーカー間が広い → 答案を拡大して合わせる
      const scaledW = Math.round(W * scale)
      const scaledH = Math.round(H * scale)

      const scaled = await sharp(translated)
        .resize(scaledW, scaledH, { kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer()

      // 中央からW×Hを切り出す
      const cropLeft = Math.round((scaledW - W) / 2)
      const cropTop = Math.round((scaledH - H) / 2)

      correctedBuffer = await safeExtract(
        scaled,
        scaledW,
        scaledH,
        cropLeft,
        cropTop,
        W,
        H
      )
    } else {
      correctedBuffer = translated
    }

    // PNG形式で出力
    correctedBuffer = await sharp(correctedBuffer).png().toBuffer()

    return {
      success: true,
      correctedBuffer,
      rotationDeg,
      translation: { tx: txCenter, ty: tyCenter },
      scale,
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
