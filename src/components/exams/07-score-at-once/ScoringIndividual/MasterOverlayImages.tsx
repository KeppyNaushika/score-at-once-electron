"use client"

import Image from "next/image"

import type { LoadedMasterPage } from "./hooks/view/useMasterOverlayImages"
import type { AnswerPageSize } from "./types"
import { placeMasterPagesOnAnswer } from "./utils/canvasPageLayout"

interface MasterOverlayImagesProps {
  /** 模範解答のページ画像 */
  masterOverlayPages: LoadedMasterPage[]
  /** 答案のページの大きさ（ページの大きさと位置は答案に合わせる） */
  answerPageSizes: AnswerPageSize[]
  pageSpacing: number
  zoom: number
  masterOverlayVisible: boolean
  masterOverlayOpacity: number
}

/**
 * 答案の上に重ねる模範解答（ページごとに、答案の同じページ＝examPageId が同じページの
 * 位置と大きさで置く。答案に無いページの模範解答は重ねない）
 */
export function MasterOverlayImages({
  masterOverlayPages,
  answerPageSizes,
  pageSpacing,
  zoom,
  masterOverlayVisible,
  masterOverlayOpacity,
}: MasterOverlayImagesProps) {
  return placeMasterPagesOnAnswer(
    masterOverlayPages,
    answerPageSizes,
    pageSpacing
  ).map(({ masterPage, left, top, width, height }) => (
    <Image
      key={masterPage.examPageId}
      src={masterPage.image.src}
      alt="模範解答"
      width={width}
      height={height}
      unoptimized
      // appimg:// は next/image の既定で lazy になる。重ね表示は
      // ズーム・スクロールされる領域にあり、素の <img> は eager だった
      loading="eager"
      className="pointer-events-none absolute block"
      style={{
        left: `${left * zoom}px`,
        top: `${top * zoom}px`,
        width: `${width * zoom}px`,
        height: `${height * zoom}px`,
        imageRendering: "pixelated",
        opacity: masterOverlayVisible ? masterOverlayOpacity / 100 : 0,
        transition: "opacity 0.15s ease-in-out",
      }}
      draggable={false}
    />
  ))
}
