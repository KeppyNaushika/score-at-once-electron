// @vitest-environment jsdom
/**
 * 07 個別表示: 模範解答のページを、答案の同じページ（examPageId）の位置と大きさに置くことの固定。
 *
 * 答案画像はその生徒の「ある分だけ」を詰めて積むので、模範解答の i 枚目を答案の i 枚目に
 * 置くと、真ん中のページが欠けた答案で模範の2枚目が答案の3枚目の位置に来る（#1485）。
 * 答案に無いページの模範解答は、重ねる表示でも左右に並べる表示でも置かない。
 */
import "../../setup"

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { MasterOverlayImages } from "@/components/exams/07-score-at-once/ScoringIndividual/MasterOverlayImages"
import type { AnswerPageSize } from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import { placeMasterPagesOnAnswer } from "@/components/exams/07-score-at-once/ScoringIndividual/utils/canvasPageLayout"

import { buildImage } from "./helpers/answerPageFixtures"

const PAGE_SPACING = 20

/** 3枚の試験の模範解答（読み込めたページ） */
function buildMasterPage(examPageId: string) {
  const image = buildImage(1000, 1400)
  image.src = `appimg:///master/${examPageId}.png`
  return { examPageId, image }
}
const masterPages = [
  buildMasterPage("page-1"),
  buildMasterPage("page-2"),
  buildMasterPage("page-3"),
]

/** 2ページ目が欠けた答案（1ページ目と3ページ目だけを詰めて積む）。高さはページごとに違える */
const answerWithoutPage2: AnswerPageSize[] = [
  { examPageId: "page-1", width: 1000, height: 1400 },
  { examPageId: "page-3", width: 800, height: 1200 },
]

describe("模範解答のページを答案のページに置く", () => {
  it("模範の2枚目は答案の2枚目（＝3ページ目）の位置に来ず、置かれない", () => {
    const placements = placeMasterPagesOnAnswer(
      masterPages,
      answerWithoutPage2,
      PAGE_SPACING
    )

    expect(
      placements.map((placement) => placement.masterPage.examPageId)
    ).toEqual(["page-1", "page-3"])
  })

  it("模範の3枚目は、答案の3ページ目の画像（積んだ2枚目）の位置と大きさに置く", () => {
    const placements = placeMasterPagesOnAnswer(
      masterPages,
      answerWithoutPage2,
      PAGE_SPACING
    )
    const page3Placement = placements.find(
      (placement) => placement.masterPage.examPageId === "page-3"
    )

    expect(page3Placement).toMatchObject({
      top: 1400 + PAGE_SPACING,
      // 幅の狭いページはキャンバス（1ページ目の幅）の中央に寄せる（積んだキャンバスと同じ式）
      left: (1000 - 800) / 2,
      width: 800,
      height: 1200,
    })
  })

  it("答案のページが全部あれば、ページ番号順にそのまま積む", () => {
    const placements = placeMasterPagesOnAnswer(
      masterPages,
      [
        { examPageId: "page-1", width: 1000, height: 1400 },
        { examPageId: "page-2", width: 1000, height: 1400 },
        { examPageId: "page-3", width: 1000, height: 1400 },
      ],
      PAGE_SPACING
    )

    expect(placements.map((placement) => placement.top)).toEqual([
      0,
      1400 + PAGE_SPACING,
      2 * (1400 + PAGE_SPACING),
    ])
  })

  it("読み込めなかった模範のページを詰めても、後ろのページはずれない", () => {
    const placements = placeMasterPagesOnAnswer(
      [masterPages[0], masterPages[2]],
      [
        { examPageId: "page-1", width: 1000, height: 1400 },
        { examPageId: "page-2", width: 1000, height: 1000 },
        { examPageId: "page-3", width: 1000, height: 1400 },
      ],
      PAGE_SPACING
    )

    expect(placements[1]).toMatchObject({
      top: 1400 + PAGE_SPACING + 1000 + PAGE_SPACING,
    })
  })
})

describe("答案に重ねる模範解答（MasterOverlayImages）", () => {
  it("2ページ目が欠けた答案では、模範の2枚目を描かず、3枚目を答案の3ページ目の位置に描く", () => {
    const zoom = 0.5
    const { container } = render(
      <MasterOverlayImages
        masterOverlayPages={masterPages}
        answerPageSizes={answerWithoutPage2}
        pageSpacing={PAGE_SPACING}
        zoom={zoom}
        masterOverlayVisible
        masterOverlayOpacity={50}
      />
    )
    const overlayImages = Array.from(container.querySelectorAll("img"))

    expect(overlayImages).toHaveLength(2)
    expect(
      overlayImages.some((image) => image.src.includes("page-2"))
    ).toBe(false)
    const page3Image = overlayImages.find((image) =>
      image.src.includes("page-3")
    )
    expect(page3Image?.style.top).toBe(`${(1400 + PAGE_SPACING) * zoom}px`)
    expect(page3Image?.style.height).toBe(`${1200 * zoom}px`)
  })
})
