/**
 * 助言の朱書きの置き場所と、文を書き換えるときの折り返し（docs/vlm-grading-design.md §9）。
 *
 * ここで固定すること:
 * - 占有グリッドの列数・行数から用紙の向きを決める
 * - 置いた朱書きは印（isRubricAdvice）・朱色・左上の角で、文字の大きさは mm。手書きに重ならない
 * - 測れなかった答案でも枠の中に置ける。文が空なら置かない
 * - 文を書き換えるときは、朱書きの左端から枠の右端までの幅で段落ごとに折り返す
 * - 書き換えた文が今の位置・大きさで枠に収まり手書きに重ならなければ位置と大きさを保ち、
 *   収まらなければ置き直す（測れなかった答案は枠全体を空きとして判定する）
 * - 答案のほかの文字の注釈も埋まっている場所として避ける（置くときも、位置を保てるかを見るときも）。
 *   注釈の箱は文・文字の大きさ・anchorDirection から見積もる
 * - 比べるときは空白・改行・$ を除く
 */

import { describe, expect, it } from "vitest"

import {
  ADVICE_FONT_SIZE_MM,
  inferPaperDimensionsFromInkGrid,
  normalizeAdviceText,
  placeAdviceAnnotation,
  replaceAdviceAnnotationText,
  rewrapAdviceText,
  textAnnotationRectangleOf,
} from "@/components/exams/07-score-at-once/Rubric/utils/adviceAnnotationPlacement"
import {
  type NormalizedRectangle,
  withOccupiedRectangles,
} from "@/lib/shared/aiGrading/annotationPlacement"
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

describe("replaceAdviceAnnotationText", () => {
  /** 枠の上から row 行目・左から column 列目（1mm 角）の用紙比の位置 */
  const at = (column: number, row: number) => ({
    x: region.x + column / 210,
    y: region.y + row / 297,
  })

  it("今の位置・大きさで収まれば、位置と大きさを保って折り返すだけ（教員が動かした位置を保つ）", () => {
    const inkGrid = makeInkGrid((_column, row) => row < 10)
    const moved = { ...at(30, 20), fontSize: 5 }
    const replaced = replaceAdviceAnnotationText("単位まで書こう", moved, {
      inkGrid,
      region,
      pageSize: "A4",
    })
    expect(replaced).toEqual({
      text: "単位まで書こう",
      x: moved.x,
      y: moved.y,
      fontSize: 5,
    })
  })

  it("長くなって枠の下へはみ出すなら、置き直す（位置・大きさ・折り返しが変わる）", () => {
    const inkGrid = makeInkGrid(() => false)
    // 下から 5 行目に置いた 5mm の文字。2行になると 14mm で枠の下を越える
    const nearBottom = { ...at(0, 54), fontSize: 5 }
    const longText = "途中式も省かずに書いて、単位まで正しく書こう。".repeat(2)
    const replaced = replaceAdviceAnnotationText(longText, nearBottom, {
      inkGrid,
      region,
      pageSize: "A4",
    })
    expect(replaced).toEqual(
      expect.objectContaining({
        text: placeAdviceAnnotation(longText, {
          inkGrid,
          region,
          pageSize: "A4",
        })?.text,
      })
    )
    expect(replaced.y).toBeLessThan(nearBottom.y)
  })

  it("長くなって手書きに掛かるなら、手書きを避けて置き直す", () => {
    // 右半分（53 列目から）が手書き
    const inkGrid = makeInkGrid((column) => column >= 53)
    const leftTop = { ...at(0, 0), fontSize: 5 }
    expect(
      replaceAdviceAnnotationText("単位", leftTop, {
        inkGrid,
        region,
        pageSize: "A4",
      })
    ).toMatchObject({ x: leftTop.x, y: leftTop.y, fontSize: 5 })
    const replaced = replaceAdviceAnnotationText(
      "途中式も省かずに書こう",
      leftTop,
      { inkGrid, region, pageSize: "A4" }
    )
    // 1行（11字・55mm）では手書きに掛かるので、左半分の中で折り返して置き直す
    expect(replaced.text).toContain("\n")
    expect(replaced.x).toBeGreaterThanOrEqual(region.x)
  })

  it("測れなかった答案は枠全体を空きとして判定する（収まれば保ち、はみ出せば置き直す）", () => {
    const context = { inkGrid: null, region, pageSize: "A4" }
    const inside = { ...at(10, 10), fontSize: 5 }
    expect(replaceAdviceAnnotationText("単位", inside, context)).toEqual({
      text: "単位",
      x: inside.x,
      y: inside.y,
      fontSize: 5,
    })
    const nearBottom = { ...at(0, 56), fontSize: 5 }
    const replaced = replaceAdviceAnnotationText(
      "途中式も省かずに書こう",
      nearBottom,
      context
    )
    expect(replaced.y).toBeLessThan(nearBottom.y)
    expect(replaced.y).toBeGreaterThanOrEqual(region.y)
  })
})

describe("ほかの文字の注釈を避ける", () => {
  const A4_PORTRAIT = { width: 210, height: 297 }
  /** 2つの矩形が重なるか（辺が接するだけなら重ならない） */
  const intersects = (
    rectangleA: NormalizedRectangle,
    rectangleB: NormalizedRectangle
  ) =>
    rectangleA.x < rectangleB.x + rectangleB.width - 1e-9 &&
    rectangleB.x < rectangleA.x + rectangleA.width - 1e-9 &&
    rectangleA.y < rectangleB.y + rectangleB.height - 1e-9 &&
    rectangleB.y < rectangleA.y + rectangleA.height - 1e-9
  /** 置いた朱書きの箱（置けなかったら失敗させる） */
  const placedRectangleOf = (
    annotation: ReturnType<typeof placeAdviceAnnotation>
  ) => {
    if (!annotation) throw new Error("朱書きを置けなかった")
    return textAnnotationRectangleOf(annotation, A4_PORTRAIT)
  }
  /** 手で書いた注釈（左上の角。枠の左下、ふだん朱書きを置くところ） */
  const handWritten = {
    x: region.x,
    y: region.y + 48 / 297,
    text: "よく書けました",
    fontSize: 5,
    anchorDirection: "top-left" as const,
  }

  it("注釈の箱は文・文字の大きさから見積もり、anchorDirection に合わせる", () => {
    // 半角2字（0.55×2）× 10mm = 11mm、1行 × 10mm × 1.4 = 14mm
    const base = { x: 0.5, y: 0.5, text: "ab", fontSize: 10 }
    const bottomRight = textAnnotationRectangleOf(
      { ...base, anchorDirection: "bottom-right" },
      A4_PORTRAIT
    )
    expect(bottomRight.width).toBeCloseTo(11 / 210)
    expect(bottomRight.height).toBeCloseTo(14 / 297)
    expect(bottomRight.x).toBeCloseTo(0.5 - 11 / 210)
    expect(bottomRight.y).toBeCloseTo(0.5 - 14 / 297)
    const center = textAnnotationRectangleOf(
      { ...base, anchorDirection: "center" },
      A4_PORTRAIT
    )
    expect(center.x).toBeCloseTo(0.5 - 5.5 / 210)
    expect(center.y).toBeCloseTo(0.5 - 7 / 297)
  })

  it("置くとき、手書きと同じくほかの文字の注釈を避ける（注釈は動かさない）", () => {
    const withoutOthers = placeAdviceAnnotation("単位を書こう", {
      inkGrid: makeInkGrid(() => false),
      region,
      pageSize: "A4",
    })
    // 何も無ければ、手で書いた注釈の場所（枠の左下）に置かれる
    expect(
      intersects(
        placedRectangleOf(withoutOthers),
        textAnnotationRectangleOf(handWritten, A4_PORTRAIT)
      )
    ).toBe(true)

    const annotation = placeAdviceAnnotation("単位を書こう", {
      inkGrid: makeInkGrid(() => false),
      region,
      pageSize: "A4",
      occupyingAnnotations: [handWritten],
    })
    expect(
      intersects(
        placedRectangleOf(annotation),
        textAnnotationRectangleOf(handWritten, A4_PORTRAIT)
      )
    ).toBe(false)
  })

  it("書き換えるとき、今の位置がほかの文字の注釈に掛かれば置き直し、掛からなければ保つ", () => {
    const placedAdvice = {
      x: region.x + 10 / 210,
      y: region.y + 10 / 297,
      fontSize: 5,
    }
    const clear = { inkGrid: null, region, pageSize: "A4" }
    expect(replaceAdviceAnnotationText("単位", placedAdvice, clear)).toEqual({
      text: "単位",
      ...placedAdvice,
    })
    const overlapping = {
      x: placedAdvice.x + 3 / 210,
      y: placedAdvice.y,
      text: "済",
      fontSize: 5,
      anchorDirection: "top-left" as const,
    }
    const replaced = replaceAdviceAnnotationText("単位", placedAdvice, {
      ...clear,
      occupyingAnnotations: [overlapping],
    })
    expect(replaced.x !== placedAdvice.x || replaced.y !== placedAdvice.y).toBe(
      true
    )
    expect(
      intersects(
        textAnnotationRectangleOf(
          { ...replaced, anchorDirection: "top-left" },
          A4_PORTRAIT
        ),
        textAnnotationRectangleOf(overlapping, A4_PORTRAIT)
      )
    ).toBe(false)
  })

  it("グリッドに重ねるのは矩形に掛かるセルだけで、元のグリッドは書き換えない。矩形が無ければ同じグリッド", () => {
    const inkGrid = makeInkGrid(() => false)
    expect(withOccupiedRectangles(inkGrid, [])).toBe(inkGrid)
    const occupied = withOccupiedRectangles(inkGrid, [
      {
        x: region.x + 2 / 210,
        y: region.y + 3 / 297,
        width: 2 / 210,
        height: 1 / 297,
      },
    ])
    const occupiedIndexes = occupied.occupiedCells.flatMap(
      (isOccupied, cellIndex) => (isOccupied ? [cellIndex] : [])
    )
    expect(occupiedIndexes).toEqual([3 * 105 + 2, 3 * 105 + 3])
    expect(inkGrid.occupiedCells.some((isOccupied) => isOccupied)).toBe(false)
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
