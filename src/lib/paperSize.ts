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
 * 用紙サイズ名と向きから、画像の左右・上下に対応する用紙の寸法（mm）を返す。
 * 横向きなら幅と高さを入れ替える。未知の用紙サイズは A4 として扱う。
 *
 * @param pageSize 用紙サイズ名（"A4"等）
 * @param isLandscape 横向きか（画像の幅が高さより大きいか）
 */
export function getOrientedPaperDimensions(
  pageSize: string,
  isLandscape: boolean
): { width: number; height: number } {
  const paper = PAPER_DIMENSIONS[pageSize] ?? PAPER_DIMENSIONS.A4
  return isLandscape
    ? { width: paper.height, height: paper.width }
    : { width: paper.width, height: paper.height }
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
  // 画像のアスペクト比から縦横を自動判定
  const isLandscape = imageWidthPx > imageHeightPx
  return imageWidthPx / getOrientedPaperDimensions(pageSize, isLandscape).width
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
