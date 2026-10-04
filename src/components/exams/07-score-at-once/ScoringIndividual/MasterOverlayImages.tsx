"use client"

import Image from "next/image"

interface MasterOverlayImagesProps {
  /** 模範解答のページ画像 */
  masterOverlayImages: HTMLImageElement[]
  /** 答案のページ画像（ページの大きさと位置は答案に合わせる） */
  loadedImages: HTMLImageElement[]
  pageSpacing: number
  zoom: number
  masterOverlayVisible: boolean
  masterOverlayOpacity: number
}

/** 答案の上に重ねる模範解答（ページごとに、答案の同じページの位置と大きさで置く） */
export function MasterOverlayImages({
  masterOverlayImages,
  loadedImages,
  pageSpacing,
  zoom,
  masterOverlayVisible,
  masterOverlayOpacity,
}: MasterOverlayImagesProps) {
  return masterOverlayImages.map((masterImage, pageIndex) => {
    // 前のページの高さ（答案が無いページは模範解答の高さ）と余白の合計
    const pageOffsetY = masterOverlayImages
      .slice(0, pageIndex)
      .reduce((offset, masterImageBefore, indexBefore) => {
        const sourceImage = loadedImages[indexBefore] || masterImageBefore
        return sourceImage
          ? offset + sourceImage.naturalHeight + (pageSpacing || 20)
          : offset
      }, 0)
    const pageImage = loadedImages[pageIndex]
    const pageWidth = pageImage
      ? pageImage.naturalWidth
      : masterImage.naturalWidth
    const pageHeight = pageImage
      ? pageImage.naturalHeight
      : masterImage.naturalHeight

    return (
      <Image
        key={`master-overlay-${pageIndex}`}
        src={masterImage.src}
        alt={`模範解答 ページ${pageIndex + 1}`}
        width={pageWidth}
        height={pageHeight}
        unoptimized
        // appimg:// は next/image の既定で lazy になる。重ね表示は
        // ズーム・スクロールされる領域にあり、素の <img> は eager だった
        loading="eager"
        className="pointer-events-none absolute left-0 block"
        style={{
          top: `${pageOffsetY * zoom}px`,
          width: `${pageWidth * zoom}px`,
          height: `${pageHeight * zoom}px`,
          imageRendering: "pixelated",
          opacity: masterOverlayVisible ? masterOverlayOpacity / 100 : 0,
          transition: "opacity 0.15s ease-in-out",
        }}
        draggable={false}
      />
    )
  })
}
