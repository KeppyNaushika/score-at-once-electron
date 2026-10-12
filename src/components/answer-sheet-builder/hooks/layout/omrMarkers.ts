/**
 * OMR マーカー（用紙の四隅の黒い四角）の座標計算と、版面との干渉の検査。
 */

import {
  MARKER_SEARCH_HEIGHT_RATIO,
  MARKER_SEARCH_WIDTH_RATIO,
} from "@/lib/omr/markerSearchRegion"
import type { GlobalSettings } from "@/types/answerSheetDefinition.types"
import type { ComputedOMRMarker } from "@/types/answerSheetLayout.types"

/**
 * マーカーと記入欄（余白の内側）の間に最低限空ける距離（mm）。
 * これより近いと、印刷のにじみや線の太りでマーカーと罫線が繋がり、隅を検出できない
 */
export const MIN_MARKER_CONTENT_GAP_MM = 2

/** スキャンで紙が端の方へずれる見込み（mm） */
export const MARKER_PAPER_SHIFT_MM = 2

/**
 * マーカーを用紙の端から離す最小の距離（mm）。
 * 紙のずれの見込みに 1mm の余裕を足す。これより端に寄ると、ずれやトリミングで欠ける
 */
export const MIN_MARKER_EDGE_OFFSET_MM = MARKER_PAPER_SHIFT_MM + 1

/** OMRマーカー（四隅）の座標を計算する */
export function computeOMRMarkers(
  settings: GlobalSettings,
  paper: { width: number; height: number }
): ComputedOMRMarker[] {
  if (!settings.omrMarkers.enabled) return []
  const { sizeMm, offsetMm } = settings.omrMarkers
  return [
    { x: offsetMm, y: offsetMm, size: sizeMm },
    { x: paper.width - offsetMm - sizeMm, y: offsetMm, size: sizeMm },
    { x: offsetMm, y: paper.height - offsetMm - sizeMm, size: sizeMm },
    {
      x: paper.width - offsetMm - sizeMm,
      y: paper.height - offsetMm - sizeMm,
      size: sizeMm,
    },
  ]
}

/** 小数1桁の mm 表記 */
function formatMm(mm: number): string {
  return `${Math.round(mm * 10) / 10}mm`
}

/**
 * マーカーの配置が OMR で読めなくなる設定を検査し、警告文を返す（問題なければ空）。
 *
 * - 記入欄（余白の内側）に近すぎる、または重なる
 * - 用紙の端に近すぎる
 * - 隅の探索範囲（用紙の幅 30%・高さ 8%）からはみ出す
 *
 * マーカーと余白は別々に設定できるので、どちらを変えても検査が要る
 */
export function checkOMRMarkerPlacement(
  settings: GlobalSettings,
  paper: { width: number; height: number }
): string[] {
  if (!settings.omrMarkers.enabled) return []
  const { sizeMm, offsetMm } = settings.omrMarkers
  const { margins } = settings
  const warnings: string[] = []

  // マーカーの内側の辺（用紙の端から）
  const innerEdge = offsetMm + sizeMm

  // 隅ごとに、縦か横のどちらかで記入欄から離れていればよい
  const cornerGaps = [
    Math.max(margins.left, margins.top),
    Math.max(margins.right, margins.top),
    Math.max(margins.left, margins.bottom),
    Math.max(margins.right, margins.bottom),
  ].map((margin) => margin - innerEdge)
  const narrowestGap = Math.min(...cornerGaps)
  if (narrowestGap < MIN_MARKER_CONTENT_GAP_MM) {
    warnings.push(
      `${
        narrowestGap < 0
          ? `マーカーが記入欄に ${formatMm(-narrowestGap)} 重なっています`
          : `マーカーと記入欄の間が ${formatMm(narrowestGap)} しかありません`
      }。罫線が接するとマーカーを検出できません。${MIN_MARKER_CONTENT_GAP_MM}mm 以上空くよう、余白を ${formatMm(innerEdge + MIN_MARKER_CONTENT_GAP_MM)} 以上にするか、マーカーを小さく・端に寄せてください`
    )
  }

  if (offsetMm < MIN_MARKER_EDGE_OFFSET_MM) {
    warnings.push(
      `マーカーが用紙の端に近すぎます（${formatMm(offsetMm)}）。スキャンで紙がずれたりトリミングされたりすると欠けて検出できません。端から ${MIN_MARKER_EDGE_OFFSET_MM}mm 以上離してください`
    )
  }

  // 紙がずれても探索範囲に収まること
  const reachX = paper.width * MARKER_SEARCH_WIDTH_RATIO
  const reachY = paper.height * MARKER_SEARCH_HEIGHT_RATIO
  const reach = Math.min(reachX, reachY) - MARKER_PAPER_SHIFT_MM
  if (innerEdge > reach) {
    warnings.push(
      `マーカーが隅の探索範囲（端から ${formatMm(reach)} まで）からはみ出します。マーカーを小さくするか、端に寄せてください`
    )
  }

  return warnings
}
