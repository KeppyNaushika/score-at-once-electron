/**
 * SVG文字列生成（renderer側）
 *
 * ComputedLayoutからSVG文字列を生成する。
 * main側に渡してsharpでPNG化、またはprintToPDFでPDF化する。
 */

import type { ComputedCell } from "@/types/answerSheetLayout.types"

/** セル内の画像パスをbase64 data URIに一括変換する（エクスポート時に使用） */
export async function resolveImageDataUris(
  cells: ComputedCell[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const paths = new Set<string>()

  for (const cell of cells) {
    if (!cell.imageElements?.length) continue
    for (const imageElement of cell.imageElements) {
      paths.add(imageElement.imagePath)
    }
  }

  if (paths.size === 0) return map

  const api = window.electronAPI
  if (!api?.getImageData) return map

  await Promise.all(
    [...paths].map(async (imagePath) => {
      try {
        map.set(imagePath, await api.getImageData(imagePath))
      } catch {
        console.warn("Failed to resolve image data URI:", imagePath)
      }
    })
  )

  return map
}
