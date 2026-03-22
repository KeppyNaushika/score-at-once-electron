/**
 * SVG文字列生成（renderer側）
 *
 * ComputedLayoutからSVG文字列を生成する。
 * main側に渡してsharpでPNG化、またはprintToPDFでPDF化する。
 */

import type { ComputedCell } from "@/types/answerSheetLayout.types"

/**
 * セル群から画像要素のパスを収集し、appimg:// → base64 data URI に変換する。
 * エクスポート時（PDF/PNG/印刷）に使用。
 */
export async function resolveImageDataUris(
  cells: ComputedCell[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const paths = new Set<string>()

  for (const cell of cells) {
    if (!cell.imageElements?.length) continue
    for (const ie of cell.imageElements) {
      paths.add(ie.imagePath)
    }
  }

  if (paths.size === 0) return map

  const api = window.electronAPI
  if (!api?.getImageData) return map

  await Promise.all(
    [...paths].map(async (imagePath) => {
      try {
        const result = await api.getImageData(imagePath)
        if (result.success && result.data) {
          map.set(imagePath, result.data)
        }
      } catch {
        console.warn("Failed to resolve image data URI:", imagePath)
      }
    })
  )

  return map
}
