/**
 * 採点マーク画像の着色（tint）
 */

/**
 * 着色済みマーク画像のキャッシュ（画像src + 色 をキーに再利用）
 */
const tintedMarkCache = new Map<string, HTMLCanvasElement>()

/**
 * 単色シルエットのマーク画像を任意の色に着色する。
 *
 * `source-in` 合成により元画像のアルファ（アンチエイリアスの縁・半透明）を
 * そのまま保ったまま、RGBだけを指定色に置き換える。
 */
export function getTintedMark(
  markImage: HTMLImageElement,
  color: string
): HTMLCanvasElement {
  const width = markImage.naturalWidth || markImage.width
  const height = markImage.naturalHeight || markImage.height
  const cacheKey = `${markImage.src}__${color}__${width}x${height}`

  const cached = tintedMarkCache.get(cacheKey)
  if (cached) return cached

  const offscreen = document.createElement("canvas")
  offscreen.width = width
  offscreen.height = height
  const octx = offscreen.getContext("2d")
  if (octx) {
    octx.drawImage(markImage, 0, 0, width, height)
    octx.globalCompositeOperation = "source-in"
    octx.fillStyle = color
    octx.fillRect(0, 0, width, height)
  }

  tintedMarkCache.set(cacheKey, offscreen)
  return offscreen
}
