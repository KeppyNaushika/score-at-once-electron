import { describe, expect, it } from "vitest"

import { nameMaskRectsWithin } from "@/components/exams/07-score-at-once/ScoringMain/utils/nameRegionMasks"

const WHOLE_PAGE = { x: 0, y: 0, width: 1, height: 1 }

describe("nameMaskRectsWithin", () => {
  it("ページ全体を描くときは、氏名欄をページ上の比のまま返す", () => {
    const nameRegion = { x: 0.6, y: 0.02, width: 0.3, height: 0.05 }
    const maskRects = nameMaskRectsWithin([nameRegion], WHOLE_PAGE)
    expect(maskRects).toHaveLength(1)
    expect(maskRects[0].x).toBeCloseTo(0.6)
    expect(maskRects[0].y).toBeCloseTo(0.02)
    expect(maskRects[0].width).toBeCloseTo(0.3)
    expect(maskRects[0].height).toBeCloseTo(0.05)
  })

  it("見えている範囲に掛からない氏名欄は返さない", () => {
    const nameRegion = { x: 0.6, y: 0.02, width: 0.3, height: 0.05 }
    const questionArea = { x: 0.1, y: 0.4, width: 0.3, height: 0.2 }
    expect(nameMaskRectsWithin([nameRegion], questionArea)).toEqual([])
  })

  it("辺が接するだけの氏名欄は返さない", () => {
    const nameRegion = { x: 0.1, y: 0.2, width: 0.3, height: 0.2 }
    const questionArea = { x: 0.1, y: 0.4, width: 0.3, height: 0.2 }
    expect(nameMaskRectsWithin([nameRegion], questionArea)).toEqual([])
  })

  it("一部だけ掛かる氏名欄は、範囲内に切り落として範囲に対する比で返す", () => {
    // 範囲 x: 0.2〜0.6, y: 0.1〜0.3。氏名欄 x: 0.5〜0.8, y: 0.0〜0.2
    const nameRegion = { x: 0.5, y: 0, width: 0.3, height: 0.2 }
    const questionArea = { x: 0.2, y: 0.1, width: 0.4, height: 0.2 }
    const [maskRect] = nameMaskRectsWithin([nameRegion], questionArea)
    // 掛かるのは x: 0.5〜0.6, y: 0.1〜0.2
    expect(maskRect.x).toBeCloseTo(0.75)
    expect(maskRect.y).toBeCloseTo(0)
    expect(maskRect.width).toBeCloseTo(0.25)
    expect(maskRect.height).toBeCloseTo(0.5)
  })

  it("範囲を覆う氏名欄は、範囲全体になる", () => {
    const nameRegion = { x: 0, y: 0, width: 1, height: 0.5 }
    const questionArea = { x: 0.2, y: 0.1, width: 0.4, height: 0.2 }
    const [maskRect] = nameMaskRectsWithin([nameRegion], questionArea)
    expect(maskRect.x).toBeCloseTo(0)
    expect(maskRect.y).toBeCloseTo(0)
    expect(maskRect.width).toBeCloseTo(1)
    expect(maskRect.height).toBeCloseTo(1)
  })

  it("掛かる欄だけを、渡した順に返す", () => {
    const studentNameRegion = { x: 0.5, y: 0.05, width: 0.4, height: 0.05 }
    const studentIdRegion = { x: 0.1, y: 0.05, width: 0.2, height: 0.05 }
    const farRegion = { x: 0.1, y: 0.9, width: 0.2, height: 0.05 }
    const topBand = { x: 0, y: 0, width: 1, height: 0.2 }
    const maskRects = nameMaskRectsWithin(
      [studentNameRegion, farRegion, studentIdRegion],
      topBand
    )
    expect(maskRects).toHaveLength(2)
    expect(maskRects[0].x).toBeCloseTo(0.5)
    expect(maskRects[1].x).toBeCloseTo(0.1)
  })

  it("大きさ0の範囲では何も返さない", () => {
    const nameRegion = { x: 0, y: 0, width: 1, height: 1 }
    expect(
      nameMaskRectsWithin([nameRegion], { x: 0.5, y: 0.5, width: 0, height: 0 })
    ).toEqual([])
  })
})
