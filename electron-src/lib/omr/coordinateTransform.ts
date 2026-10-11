/**
 * 双一次補間による座標変換
 *
 * Mark2の BilinearInterpolation を移植。
 * 4つのコーナーマーカー位置を対応点として、
 * 0-1正規化座標 → 実画像ピクセル座標に変換する。
 */

import type { CoordinateTransform, Point } from "../../../src/types/omr.types"

/**
 * CoordinateTransform を構築する
 *
 * @param detectedCorners 検出された4隅のピクセル座標 [TL, TR, BL, BR]
 * @param expectedCorners レイアウト上の4隅の0-1正規化座標 [TL, TR, BL, BR]
 * @param imageWidth 画像幅(px)
 * @param imageHeight 画像高さ(px)
 */
export function createTransform(
  detectedCorners: [Point, Point, Point, Point],
  expectedCorners: [Point, Point, Point, Point],
  imageWidth: number,
  imageHeight: number
): CoordinateTransform {
  return {
    detectedCorners,
    expectedCorners,
    imageWidth,
    imageHeight,
  }
}

/**
 * 0-1正規化座標 → 実画像ピクセル座標へ変換（双一次補間）
 *
 * 4つのコーナーマーカーの検出位置と期待位置から補間係数を求め、
 * 任意の正規化座標をピクセル座標に変換する。
 *
 * 双一次補間の式:
 * P(u,v) = (1-u)(1-v) * P_TL + u(1-v) * P_TR + (1-u)v * P_BL + uv * P_BR
 *
 * ここで u, v は正規化座標を期待コーナーの範囲にマッピングした0-1パラメータ。
 */
export function normalizedToPixel(
  nx: number,
  ny: number,
  transform: CoordinateTransform
): Point {
  const eTL = transform.expectedCorners[0]
  const eTR = transform.expectedCorners[1]
  const eBL = transform.expectedCorners[2]
  const [dTL, dTR, dBL, dBR] = transform.detectedCorners

  // 正規化座標を期待コーナーの範囲にマッピング
  // u: 左→右 (0→1), v: 上→下 (0→1)
  const u = inverseLerp(eTL.x, eTR.x, nx)
  const v = inverseLerp(eTL.y, eBL.y, ny)

  // 双一次補間
  const px =
    (1 - u) * (1 - v) * dTL.x +
    u * (1 - v) * dTR.x +
    (1 - u) * v * dBL.x +
    u * v * dBR.x

  const py =
    (1 - u) * (1 - v) * dTL.y +
    u * (1 - v) * dTR.y +
    (1 - u) * v * dBL.y +
    u * v * dBR.y

  return { x: px, y: py }
}

/**
 * 逆線形補間: a→bの範囲でvが占める割合を返す
 */
function inverseLerp(
  rangeStart: number,
  rangeEnd: number,
  value: number
): number {
  if (Math.abs(rangeEnd - rangeStart) < 1e-10) return 0
  return (value - rangeStart) / (rangeEnd - rangeStart)
}
