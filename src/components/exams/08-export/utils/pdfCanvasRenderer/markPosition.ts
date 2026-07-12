/**
 * 採点マーク・点数テキストの位置計算
 */

/**
 * 採点マークの位置を計算
 */
export function calculateMarkPosition(
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
  markSize: number,
  position: string
): { x: number; y: number } {
  const padding = 5

  switch (position) {
    case "top-left":
      return { x: regionX + padding, y: regionY + padding }
    case "top-center":
      return { x: regionX + (regionWidth - markSize) / 2, y: regionY + padding }
    case "top-right":
      return {
        x: regionX + regionWidth - markSize - padding,
        y: regionY + padding,
      }
    case "middle-left":
      return {
        x: regionX + padding,
        y: regionY + (regionHeight - markSize) / 2,
      }
    case "middle-center":
      return {
        x: regionX + (regionWidth - markSize) / 2,
        y: regionY + (regionHeight - markSize) / 2,
      }
    case "middle-right":
      return {
        x: regionX + regionWidth - markSize - padding,
        y: regionY + (regionHeight - markSize) / 2,
      }
    case "bottom-left":
      return {
        x: regionX + padding,
        y: regionY + regionHeight - markSize - padding,
      }
    case "bottom-center":
      return {
        x: regionX + (regionWidth - markSize) / 2,
        y: regionY + regionHeight - markSize - padding,
      }
    case "bottom-right":
      return {
        x: regionX + regionWidth - markSize - padding,
        y: regionY + regionHeight - markSize - padding,
      }
    default:
      // デフォルトは中央
      return {
        x: regionX + (regionWidth - markSize) / 2,
        y: regionY + (regionHeight - markSize) / 2,
      }
  }
}

/**
 * 部分点テキストの位置を計算
 */
export function calculatePartialScorePosition(
  regionX: number,
  regionY: number,
  regionWidth: number,
  regionHeight: number,
  position: string,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  let baseX: number
  let baseY: number

  switch (position) {
    case "top-left":
      baseX = regionX
      baseY = regionY
      break
    case "top-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY
      break
    case "top-right":
      baseX = regionX + regionWidth
      baseY = regionY
      break
    case "middle-left":
      baseX = regionX
      baseY = regionY + regionHeight / 2
      break
    case "middle-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight / 2
      break
    case "middle-right":
      baseX = regionX + regionWidth
      baseY = regionY + regionHeight / 2
      break
    case "bottom-left":
      baseX = regionX
      baseY = regionY + regionHeight
      break
    case "bottom-center":
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight
      break
    case "bottom-right":
      baseX = regionX + regionWidth
      baseY = regionY + regionHeight
      break
    default:
      // デフォルトは中央
      baseX = regionX + regionWidth / 2
      baseY = regionY + regionHeight / 2
      break
  }

  return {
    x: baseX + offsetX,
    y: baseY + offsetY,
  }
}
