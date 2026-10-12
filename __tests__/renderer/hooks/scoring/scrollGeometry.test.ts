// @vitest-environment jsdom
/**
 * 07 個別表示: 設問へのスクロール位置（locateQuestionOnCanvas）が、描画で設問を置く
 * ページ（loadedPageIndexOfCropRegion）と一致することの固定。
 *
 * 答案画像はその生徒の「ある分だけ」をページ番号順に詰めて並べるので、ページ番号から
 * 添字は作れない。真ん中のページが欠けた答案で、2枚目の設問が3枚目の画像の上に描かれ、
 * スクロールもそこへ行っていた（#1485）。ページは examPageId で同定し、答案に無い
 * ページの設問にはスクロールしない。
 */
import { describe, expect, it } from "vitest"

import { locateQuestionOnCanvas } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/view/scrollGeometry"
import {
  loadedPageIndexOfCropRegion,
  pagePlacementAt,
} from "@/components/exams/07-score-at-once/ScoringIndividual/utils/canvasPageLayout"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { buildCropRegion, buildImage } from "./helpers/answerPageFixtures"

const PAGE_SPACING = 20

/** 描画側（drawCropRegionMarks / drawMainCanvas）と同じ式で求めた枠の中心 */
function drawnFrameCenter(
  cropRegion: QuestionAnswerRegionRow,
  images: HTMLImageElement[],
  loadedExamPageIds: string[]
): { x: number; y: number } | null {
  const pageIndex = loadedPageIndexOfCropRegion(cropRegion, loadedExamPageIds)
  if (pageIndex === null) return null
  const { pageImage, offsetX, offsetY } = pagePlacementAt(
    images,
    pageIndex,
    PAGE_SPACING
  )
  return {
    x: (cropRegion.x + cropRegion.width / 2) * pageImage.naturalWidth + offsetX,
    y:
      (cropRegion.y + cropRegion.height / 2) * pageImage.naturalHeight +
      offsetY,
  }
}

describe("locateQuestionOnCanvas", () => {
  it("欠けていない答案: 設問のページの枠の中心を返す（座標は従来どおり）", () => {
    const images = [buildImage(1000, 1400), buildImage(800, 1200)]
    const loadedExamPageIds = ["page-1", "page-2"]
    const cropRegion = buildCropRegion("page-2", 2)
    const location = locateQuestionOnCanvas(
      cropRegion,
      images,
      loadedExamPageIds,
      PAGE_SPACING
    )

    expect(location?.questionImage).toBe(images[1])
    // x: (0.25 + 0.1) * 800 + (1000 - 800) / 2 = 380
    // y: (0.5 + 0.05) * 1200 + 1400 + 20 = 2080
    expect(location?.centerX).toBeCloseTo(380)
    expect(location?.centerY).toBeCloseTo(2080)
    expect(location && { x: location.centerX, y: location.centerY }).toEqual(
      drawnFrameCenter(cropRegion, images, loadedExamPageIds)
    )
  })

  it("真ん中のページが欠けた答案: 3枚目の設問は詰めた2枚目の画像の位置に来る", () => {
    const images = [buildImage(1000, 1400), buildImage(800, 1200)]
    const loadedExamPageIds = ["page-1", "page-3"]
    const cropRegion = buildCropRegion("page-3", 3)
    const location = locateQuestionOnCanvas(
      cropRegion,
      images,
      loadedExamPageIds,
      PAGE_SPACING
    )

    expect(location?.questionImage).toBe(images[1])
    expect(location?.centerY).toBeCloseTo(2080)
    expect(location && { x: location.centerX, y: location.centerY }).toEqual(
      drawnFrameCenter(cropRegion, images, loadedExamPageIds)
    )
  })

  it("真ん中のページが欠けた答案: 2枚目の設問は3枚目の画像へスクロールしない", () => {
    const images = [buildImage(1000, 1400), buildImage(800, 1200)]
    const location = locateQuestionOnCanvas(
      buildCropRegion("page-2", 2),
      images,
      ["page-1", "page-3"],
      PAGE_SPACING
    )

    expect(location).toBe(null)
  })

  it("1ページ表示モード: 読み込んだ1枚が設問のページなら、ずらさずにその中心", () => {
    const images = [buildImage(1000, 1400)]
    const location = locateQuestionOnCanvas(
      buildCropRegion("page-2", 2),
      images,
      ["page-2"],
      PAGE_SPACING
    )

    expect(location?.questionImage).toBe(images[0])
    expect(location?.centerX).toBeCloseTo(350)
    expect(location?.centerY).toBeCloseTo(770)
  })

  it("1ページ表示モード: 別のページの設問は null", () => {
    expect(
      locateQuestionOnCanvas(
        buildCropRegion("page-1", 1),
        [buildImage(1000, 1400)],
        ["page-2"],
        PAGE_SPACING
      )
    ).toBe(null)
  })

  it("画像が無いときは null", () => {
    expect(
      locateQuestionOnCanvas(
        buildCropRegion("page-1", 1),
        [],
        [],
        PAGE_SPACING
      )
    ).toBe(null)
  })
})
