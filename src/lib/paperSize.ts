/**
 * 用紙サイズ定数とmm⇔ピクセル変換ユーティリティ
 *
 * strokeWidth / fontSize をmm単位で管理し、
 * 描画時に画像ピクセルに変換するための共通関数を提供する。
 */

/** 用紙サイズ（mm） */
export const PAPER_DIMENSIONS: Record<
  string,
  { width: number; height: number }
> = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  B4: { width: 257, height: 364 },
  B5: { width: 182, height: 257 },
}

/**
 * 用紙サイズと画像ピクセル幅から、mm→ピクセル変換係数を取得
 *
 * @param pageSize 用紙サイズ名（"A4"等）
 * @param imageWidthPx 画像の幅（ピクセル）
 * @param imageHeightPx 画像の高さ（ピクセル）
 * @returns 1mmあたりのピクセル数
 */
function getMmToPixelRatio(
  pageSize: string,
  imageWidthPx: number,
  imageHeightPx: number
): number {
  const paper = PAPER_DIMENSIONS[pageSize] ?? PAPER_DIMENSIONS.A4
  // 画像のアスペクト比から縦横を自動判定
  const isLandscape = imageWidthPx > imageHeightPx
  const paperWidthMm = isLandscape ? paper.height : paper.width
  return imageWidthPx / paperWidthMm
}

/**
 * mm値をCanvasピクセルに変換
 */
export function mmToPixels(
  mm: number,
  pageSize: string,
  imageWidthPx: number,
  imageHeightPx: number
): number {
  return mm * getMmToPixelRatio(pageSize, imageWidthPx, imageHeightPx)
}
