/**
 * @fileoverview Shift 押下時の正方形/正円の制約
 * 新規描画（useDrawingCreation）とリサイズ（useElementResize）で共通
 */

/**
 * 幅と高さを、ピクセル単位で同じ大きさ（正方形/正円）にそろえる
 *
 * @description
 * 正規化座標で同じ値にすると画像のアスペクト比により縦横比が崩れる。
 * ピクセル単位で同じサイズになるよう、短い方の辺に合わせて変換する。
 * 符号（ドラッグの向き）はそれぞれ保つ。
 *
 * @param width - 幅（正規化座標）
 * @param height - 高さ（正規化座標）
 * @param imageAspectRatio - 画像のアスペクト比（width/height）
 * @returns 制約適用後の幅と高さ
 */
export function constrainToSquare(
  width: number,
  height: number,
  imageAspectRatio: number
): { width: number; height: number } {
  const absWidth = Math.abs(width)
  const absHeight = Math.abs(height)

  // ピクセル相当サイズで比較（imageHeightを基準に正規化）
  const pixelWidthRelative = absWidth * imageAspectRatio
  const pixelHeightRelative = absHeight

  if (pixelWidthRelative <= pixelHeightRelative) {
    const constrainedHeight = absWidth * imageAspectRatio
    return {
      width: width >= 0 ? absWidth : -absWidth,
      height: height >= 0 ? constrainedHeight : -constrainedHeight,
    }
  } else {
    const constrainedWidth = absHeight / imageAspectRatio
    return {
      width: width >= 0 ? constrainedWidth : -constrainedWidth,
      height: height >= 0 ? absHeight : -absHeight,
    }
  }
}
