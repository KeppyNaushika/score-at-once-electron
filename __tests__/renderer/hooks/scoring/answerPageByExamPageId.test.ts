// @vitest-environment jsdom
/**
 * 07 個別表示: 設問・注釈が載るページを、読み込んだ答案画像の並び（loadedExamPageIds）
 * での examPageId の位置で決めることの固定。
 *
 * 答案画像はその生徒の「ある分だけ」を詰めて並べるので、ページ番号 - 1 を添字に
 * すると、真ん中のページが欠けた答案で2枚目の設問が3枚目の画像の上に描かれる（#1485）。
 * 答案に無いページの設問は、枠も採点記号も描かない。
 */
import { describe, expect, it } from "vitest"

import type { CropRegionWithStatus } from "@/components/exams/07-score-at-once/ScoringIndividual/hooks/core/types"
import {
  canvasPointToPageCoordinates,
  loadedPageIndexOfCropRegion,
  pageIndexByCropRegionId,
} from "@/components/exams/07-score-at-once/ScoringIndividual/utils/canvasPageLayout"
import { drawCropRegionMarks } from "@/components/exams/07-score-at-once/ScoringIndividual/utils/drawCropRegionMarks"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { buildCropRegion, buildImage } from "./helpers/answerPageFixtures"

const PAGE_SPACING = 20

/** 3枚の試験の各ページの設問 */
const page1Region = buildCropRegion("page-1", 1)
const page2Region = buildCropRegion("page-2", 2)
const page3Region = buildCropRegion("page-3", 3)

function withStatus(cropRegion: QuestionAnswerRegionRow): CropRegionWithStatus {
  return {
    cropRegion,
    status: "unscored",
    actualScore: null,
    scaleLevelLabel: null,
  }
}

/** 枠（strokeRect）の左上 y と、ラベル（fillText）の文字だけを記録する */
function createRecordingContext() {
  const frames: { label: string; y: number }[] = []
  let pendingFrameY: number | null = null
  const recorder = {
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    setLineDash: () => {},
    save: () => {},
    restore: () => {},
    drawImage: () => {},
    strokeRect: (_x: number, y: number) => {
      pendingFrameY = y
    },
    fillText: (text: string) => {
      if (pendingFrameY !== null) {
        frames.push({ label: text, y: pendingFrameY })
        pendingFrameY = null
      }
    },
  }
  return {
    // 記録に要るメソッドだけを持つ偽物を Canvas として渡す
    ctx: recorder as unknown as CanvasRenderingContext2D,
    frames,
  }
}

function drawFrames(
  images: HTMLImageElement[],
  loadedExamPageIds: string[],
  currentCropRegion: QuestionAnswerRegionRow
) {
  const recording = createRecordingContext()
  drawCropRegionMarks(
    {
      ctx: recording.ctx,
      images,
      loadedExamPageIds,
      pageSpacing: PAGE_SPACING,
      zoom: 1,
      pageSize: "A4",
      scoringMarkConfig: null,
      scoringMarkImages: new Map(),
      markColorByCropRegionId: new Map(),
    },
    {
      allCropRegionsWithStatus: [page1Region, page2Region, page3Region].map(
        withStatus
      ),
      currentCropRegion,
      currentScoringData: null,
    }
  )
  return recording.frames
}

describe("loadedPageIndexOfCropRegion", () => {
  it("欠けていない答案: ページ番号順の位置と同じ", () => {
    const loadedExamPageIds = ["page-1", "page-2", "page-3"]
    expect(loadedPageIndexOfCropRegion(page1Region, loadedExamPageIds)).toBe(0)
    expect(loadedPageIndexOfCropRegion(page2Region, loadedExamPageIds)).toBe(1)
    expect(loadedPageIndexOfCropRegion(page3Region, loadedExamPageIds)).toBe(2)
  })

  it("真ん中のページが欠けた答案: 2枚目は無し、3枚目は詰めた2番目", () => {
    const loadedExamPageIds = ["page-1", "page-3"]
    expect(loadedPageIndexOfCropRegion(page2Region, loadedExamPageIds)).toBe(
      null
    )
    expect(loadedPageIndexOfCropRegion(page3Region, loadedExamPageIds)).toBe(1)
  })

  it("1ページ表示モード: 読み込んだ1枚（設問のページ）だけが当たる", () => {
    const loadedExamPageIds = ["page-2"]
    expect(loadedPageIndexOfCropRegion(page2Region, loadedExamPageIds)).toBe(0)
    expect(loadedPageIndexOfCropRegion(page1Region, loadedExamPageIds)).toBe(
      null
    )
    expect(loadedPageIndexOfCropRegion(page3Region, loadedExamPageIds)).toBe(
      null
    )
  })

  it("設問が無ければ null", () => {
    expect(loadedPageIndexOfCropRegion(null, ["page-1"])).toBe(null)
  })
})

describe("pageIndexByCropRegionId", () => {
  it("答案に無いページの設問は入れない（注釈も描かない）", () => {
    const pageIndexByRegion = pageIndexByCropRegionId(
      [page1Region, page2Region, page3Region].map(withStatus),
      ["page-1", "page-3"]
    )
    expect([...pageIndexByRegion]).toEqual([
      [page1Region.id, 0],
      [page3Region.id, 1],
    ])
  })
})

describe("drawCropRegionMarks", () => {
  // 3ページ目の上端 = 1400 + 20、枠の y = 0.5 * 1200 + 1420 = 2020
  it("真ん中のページが欠けた答案: 2枚目の設問は描かず、3枚目の設問は3枚目の画像に描く", () => {
    const images = [buildImage(1000, 1400), buildImage(1000, 1200)]
    const frames = drawFrames(images, ["page-1", "page-3"], page3Region)

    expect(frames.map((frame) => frame.label)).toEqual([
      page1Region.label,
      page3Region.label,
    ])
    expect(frames[1].y).toBeCloseTo(2020)
  })

  it("欠けていない答案: 3問とも、それぞれのページに描く（従来どおり）", () => {
    const images = [
      buildImage(1000, 1400),
      buildImage(1000, 1300),
      buildImage(1000, 1200),
    ]
    const frames = drawFrames(images, ["page-1", "page-2", "page-3"], page2Region)

    // 他の設問が先、現在の設問が最後
    expect(frames.map((frame) => frame.label)).toEqual([
      page1Region.label,
      page3Region.label,
      page2Region.label,
    ])
    expect(frames[0].y).toBeCloseTo(700)
    expect(frames[2].y).toBeCloseTo(0.5 * 1300 + 1420)
    expect(frames[1].y).toBeCloseTo(0.5 * 1200 + 1420 + 1320)
  })

  it("1ページ表示モード: 読み込んだ1枚の設問だけを、ずらさずに描く", () => {
    const frames = drawFrames([buildImage(1000, 1200)], ["page-2"], page2Region)

    expect(frames).toEqual([{ label: page2Region.label, y: 600 }])
  })
})

describe("canvasPointToPageCoordinates", () => {
  it("設問のページの中の正規化座標へ写す（幅の狭いページは中央寄せを引く）", () => {
    const images = [buildImage(1000, 1400), buildImage(800, 1200)]
    // 2ページ目の左上 = (100, 1420)
    expect(
      canvasPointToPageCoordinates(
        { x: 500, y: 2020 },
        images,
        1,
        PAGE_SPACING
      )
    ).toEqual({ x: 0.5, y: 0.5 })
  })

  it("別のページを指しても、指定したページを基準にする（範囲を外れた値になる）", () => {
    const images = [buildImage(1000, 1000), buildImage(1000, 1000)]
    const coordinates = canvasPointToPageCoordinates(
      { x: 500, y: 500 },
      images,
      1,
      PAGE_SPACING
    )
    expect(coordinates?.x).toBeCloseTo(0.5)
    expect(coordinates?.y).toBeCloseTo(-0.52)
  })
})
