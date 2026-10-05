/**
 * 匿名採点のあいだ、答案の氏名欄（STUDENT_NAME / STUDENT_ID の採点領域）を塗りつぶす
 * （docs/scoring-scope-and-permissions-design.md §3-5）。
 *
 * 一覧表示（CroppedAnswerImage）と個別表示（drawMainCanvas）の両方が使う。
 * 模範解答には塗らない（呼び出し側が生徒の答案のときだけ欄を渡す）。
 */

/** 矩形。ページ上なら採点領域と同じくページの幅・高さに対する比（0〜1）、キャンバス上なら px */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 隠したことが分かる、中立の灰色（Tailwind の zinc-300） */
const NAME_MASK_FILL = "#d4d4d8"

/**
 * 見えている範囲に掛かる氏名欄を、見えている範囲に対する比（0〜1）で返す。
 * 範囲からはみ出す部分は切り落とし、掛からない欄は返さない。
 *
 * @param nameRegions - そのページの氏名欄（ページ上の比）
 * @param visibleRect - 描いているページの範囲（ページ上の比。ページ全体なら 0,0,1,1）
 */
export function nameMaskRectsWithin(
  nameRegions: readonly Rect[],
  visibleRect: Rect
): Rect[] {
  if (visibleRect.width <= 0 || visibleRect.height <= 0) return []
  const visibleRight = visibleRect.x + visibleRect.width
  const visibleBottom = visibleRect.y + visibleRect.height

  return nameRegions.flatMap((nameRegion) => {
    const left = Math.max(nameRegion.x, visibleRect.x)
    const top = Math.max(nameRegion.y, visibleRect.y)
    const right = Math.min(nameRegion.x + nameRegion.width, visibleRight)
    const bottom = Math.min(nameRegion.y + nameRegion.height, visibleBottom)
    if (right <= left || bottom <= top) return []
    return [
      {
        x: (left - visibleRect.x) / visibleRect.width,
        y: (top - visibleRect.y) / visibleRect.height,
        width: (right - left) / visibleRect.width,
        height: (bottom - top) / visibleRect.height,
      },
    ]
  })
}

/**
 * 見えている範囲に掛かる氏名欄を、キャンバス上の描画先の矩形（px）へ塗る。
 *
 * @param destination - 見えている範囲を描いたキャンバス上の矩形（px）
 */
export function fillNameMasks(
  ctx: CanvasRenderingContext2D,
  nameRegions: readonly Rect[],
  visibleRect: Rect,
  destination: Rect
): void {
  const maskRects = nameMaskRectsWithin(nameRegions, visibleRect)
  if (maskRects.length === 0) return

  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
  ctx.fillStyle = NAME_MASK_FILL
  maskRects.forEach((maskRect) => {
    ctx.fillRect(
      destination.x + maskRect.x * destination.width,
      destination.y + maskRect.y * destination.height,
      maskRect.width * destination.width,
      maskRect.height * destination.height
    )
  })
  ctx.restore()
}
