/**
 * 答案の複数ページを縦に積んだキャンバスの配置計算
 *
 * メイン・オーバーレイ・テキストの3枚のキャンバスは同じ大きさで重なっているので、
 * ページの位置はどれも同じ式で求める。
 */
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import type { CropRegionWithStatus } from "../hooks/core/types"

/** 積んだキャンバスの大きさ（幅は1ページ目、高さは全ページ＋ページ間の余白） */
export function stackedCanvasSize(
  images: HTMLImageElement[],
  pageSpacing: number
): { width: number; height: number } {
  return {
    width: images[0].naturalWidth,
    height: images.reduce(
      (total, image, index) =>
        total +
        image.naturalHeight +
        (index < images.length - 1 ? pageSpacing : 0),
      0
    ),
  }
}

/** ページの上端の y（それより前のページの高さと余白の合計） */
export function pageOffsetY(
  images: HTMLImageElement[],
  pageIndex: number,
  pageSpacing: number
): number {
  return images
    .slice(0, pageIndex)
    .reduce(
      (offset, image) =>
        offset + image.naturalHeight + (images.length > 1 ? pageSpacing : 0),
      0
    )
}

/** ページの左端の x（幅の狭いページは中央に寄せる） */
export function pageOffsetX(
  canvasWidth: number,
  pageImage: HTMLImageElement
): number {
  return (canvasWidth - pageImage.naturalWidth) / 2
}

/** 設問が載っているページの添字（ページ数を超える番号は最後のページに丸める） */
export function pageIndexOfCropRegion(
  cropRegion: QuestionAnswerRegionRow | null | undefined,
  pageCount: number
): number {
  const pageNumber = cropRegion?.examPage?.pageNumber || 1
  return Math.min(pageNumber - 1, pageCount - 1)
}

/** cropRegionId → ページの添字 */
export function pageIndexByCropRegionId(
  allCropRegionsWithStatus: CropRegionWithStatus[],
  pageCount: number
): Map<string, number> {
  return new Map(
    allCropRegionsWithStatus.map(({ cropRegion }) => [
      cropRegion.id,
      pageIndexOfCropRegion(cropRegion, pageCount),
    ])
  )
}
