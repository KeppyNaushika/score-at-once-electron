/**
 * 助言の朱書きの置き場所と、文を書き換えるときの折り返し（docs/vlm-grading-design.md §9）。
 *
 * ここで固定すること:
 * - 占有グリッドの列数・行数から用紙の向きを決める
 * - 置いた朱書きは印（isRubricAdvice）・朱色・左上の角で、文字の大きさは mm。手書きに重ならない
 * - 測れなかった答案でも枠の中に置ける。文が空なら置かない
 * - 文を書き換えるときは、朱書きの左端から枠の右端までの幅で段落ごとに折り返す
 * - 比べるときは空白・改行・$ を除く
 */

import { describe, expect, it } from "vitest"

import {
  ADVICE_FONT_SIZE_MM,
  inferPaperDimensionsFromInkGrid,
  normalizeAdviceText,
  placeAdviceAnnotation,
  rewrapAdviceText,
} from "@/components/exams/07-score-at-once/Rubric/utils/adviceAnnotationPlacement"
import type { AnswerInkGrid } from "@/lib/shared/aiGrading/answerInkGrid"

/** A4 縦の、用紙比の設問の枠（幅 105mm・高さ 59.4mm） */
const region = { x: 0.1, y: 0.1, width: 0.5, height: 0.2 }

/** 枠の内側を1mm角に区切ったグリッド（縦）。isOccupied で埋まり方を決める */
function makeInkGrid(
  isOccupied: (column: number, row: number) => boolean
): AnswerInkGrid {
  const columnCount = 105
  const rowCount = 59
  return {
    originX: region.x,
    originY: region.y,
    cellWidth: 1 / 210,
    cellHeight: 1 / 297,
    columnCount,
    rowCount,
    occupiedCells: Array.from(
      { length: columnCount * rowCount },
      (_, cellIndex) =>
        isOccupied(cellIndex % columnCount, Math.floor(cellIndex / columnCount))
    ),
  }
}

describe("用紙の向き", () => {
  it("占有グリッドの列数・行数から、縦か横かを決める", () => {
    const portraitGrid = makeInkGrid(() => false)
    expect(inferPaperDimensionsFromInkGrid("A4", portraitGrid)).toEqual({
      width: 210,
      height: 297,
    })
    const landscapeGrid = {
      ...portraitGrid,
      cellWidth: 1 / 297,
      cellHeight: 1 / 210,
    }
    expect(inferPaperDimensionsFromInkGrid("A4", landscapeGrid)).toEqual({
      width: 297,
      height: 210,
    })
  })
})

describe("placeAdviceAnnotation", () => {
  it("印・朱色・左上の角で、文字の大きさは mm。手書き（上半分）に重ならない下に置く", () => {
    // 上の 40 行が手書きで埋まっている
    const inkGrid = makeInkGrid((_column, row) => row < 40)
    const annotation = placeAdviceAnnotation("単位を書こう", {
      inkGrid,
      region,
      pageSize: "A4",
    })
    expect(annotation).toMatchObject({
      type: "text",
      text: "単位を書こう",
      isRubricAdvice: true,
      color: "#ef4444",
      anchorDirection: "top-left",
      fontSize: ADVICE_FONT_SIZE_MM,
    })
    // 膨らませた1セルぶんも避けるので、41行目より下
    expect(annotation?.y).toBeGreaterThanOrEqual(region.y + 41 / 297 - 1e-9)
    expect(annotation?.x).toBeGreaterThanOrEqual(region.x)
  })

  it("並べた助言は段落ごとに行を分ける", () => {
    const annotation = placeAdviceAnnotation("単位を書こう\n途中式を書こう", {
      inkGrid: makeInkGrid(() => false),
      region,
      pageSize: "A4",
    })
    expect(annotation?.text).toBe("単位を書こう\n途中式を書こう")
  })

  it("測れなかった答案でも枠の中に置ける。文が空なら置かない", () => {
    const annotation = placeAdviceAnnotation("符号の誤り", {
      inkGrid: null,
      region,
      pageSize: "A4",
    })
    expect(annotation).not.toBeNull()
    expect(annotation?.x).toBeGreaterThanOrEqual(region.x)
    expect(annotation?.y).toBeGreaterThanOrEqual(region.y)
    expect(annotation?.y).toBeLessThan(region.y + region.height)
    expect(
      placeAdviceAnnotation("  $$ ", { inkGrid: null, region, pageSize: "A4" })
    ).toBeNull()
  })
})

describe("rewrapAdviceText", () => {
  it("朱書きの左端から枠の右端までの幅で、段落ごとに折り返す（位置と大きさは呼び出し側が保つ）", () => {
    // 枠の右端は 0.6（126mm）。左端 0.5（105mm）からの 21mm を 5mm の文字で 4字ずつ
    const text = rewrapAdviceText(
      "あいうえおか\nきく",
      { x: 0.5, fontSize: 5 },
      { inkGrid: makeInkGrid(() => false), region, pageSize: "A4" }
    )
    expect(text.split("\n")).toEqual(["あいうえ", "おか", "きく"])
  })

  it("枠の右端より右に動かされていても、1字ずつは置ける", () => {
    const text = rewrapAdviceText(
      "あい",
      { x: 0.9, fontSize: 5 },
      { inkGrid: null, region, pageSize: "A4" }
    )
    expect(text).toBe("あ\nい")
  })
})

describe("normalizeAdviceText", () => {
  it("空白・改行・$ を除いて比べる", () => {
    expect(normalizeAdviceText("単位を\n書こう")).toBe(
      normalizeAdviceText(" 単位を書こう ")
    )
    expect(normalizeAdviceText("$x$ を求めよう")).toBe("xを求めよう")
  })
})
