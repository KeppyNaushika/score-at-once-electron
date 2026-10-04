/**
 * AI採点の注釈の配置 テスト
 *
 * 1mm角のセル 80列 × 30行（80mm × 30mm の解答欄の内側）の占有グリッドを手で組み、
 * 空き方ごとに置き場所・折り返し・重なりの判定を確かめる。
 */

import { describe, expect, it } from "vitest"

import {
  placeAnnotation,
  sanitizeAnnotationText,
  wrapAnnotationText,
} from "@/lib/shared/aiGrading/annotationPlacement"
import type { AnswerInkGrid } from "@/lib/shared/aiGrading/answerInkGrid"

/** A4 縦 */
const PAPER_DIMENSIONS_A4 = { width: 210, height: 297 }
const COLUMN_COUNT = 80
const ROW_COUNT = 30
const FONT_SIZE_MM = 5
/** 5mm × 行送り 1.4 = 7mm = 7セル */
const LINE_ROW_SPAN = 7

/** isOccupied(column, row) で埋まり方を決めた占有グリッドを作る */
function createInkGrid(
  isOccupied: (column: number, row: number) => boolean
): AnswerInkGrid {
  return {
    originX: 0.1,
    originY: 0.2,
    cellWidth: 1 / PAPER_DIMENSIONS_A4.width,
    cellHeight: 1 / PAPER_DIMENSIONS_A4.height,
    columnCount: COLUMN_COUNT,
    rowCount: ROW_COUNT,
    occupiedCells: Array.from(
      { length: COLUMN_COUNT * ROW_COUNT },
      (_, cellIndex) =>
        isOccupied(
          cellIndex % COLUMN_COUNT,
          Math.floor(cellIndex / COLUMN_COUNT)
        )
    ),
  }
}

function place(annotationText: string, inkGrid: AnswerInkGrid) {
  return placeAnnotation({
    annotationText,
    fontSizeMm: FONT_SIZE_MM,
    paperDimensions: PAPER_DIMENSIONS_A4,
    inkGrid,
  })
}

/** 置き場所の左上を、グリッドの列・行に戻す */
function toCell(placement: { x: number; y: number }, inkGrid: AnswerInkGrid) {
  return {
    column: Math.round((placement.x - inkGrid.originX) / inkGrid.cellWidth),
    row: Math.round((placement.y - inkGrid.originY) / inkGrid.cellHeight),
  }
}

describe("placeAnnotation", () => {
  it("空のグリッドでは、いちばん下の左端に1行で置く", () => {
    const inkGrid = createInkGrid(() => false)
    const placement = place("途中式がない", inkGrid)

    expect(placement).not.toBeNull()
    expect(placement?.text).toBe("途中式がない")
    expect(placement?.lineCount).toBe(1)
    expect(placement?.fontSize).toBe(FONT_SIZE_MM)
    expect(placement?.overlapsInk).toBe(false)
    expect(placement && toCell(placement, inkGrid)).toEqual({
      column: 0,
      row: ROW_COUNT - LINE_ROW_SPAN,
    })
  })

  it("全面が埋まっていれば、重なりを示して置く", () => {
    const placement = place(
      "途中式がない",
      createInkGrid(() => true)
    )

    expect(placement?.overlapsInk).toBe(true)
  })

  it("右半分だけ空いていれば、膨らませた1セルを避けて右半分に収まる幅で折り返す", () => {
    // 左 40列に記入。膨らませると 40列目も埋まるので、空きは 41〜79列の 39mm
    const inkGrid = createInkGrid((column) => column < 40)
    const placement = place("二つ目の式で符号を取り違えて計算している", inkGrid)

    expect(placement?.overlapsInk).toBe(false)
    // 内幅 80mm の 40%（32mm）で 6字ずつ折り返した4行（幅 30mm）だけが収まる
    expect(placement?.lineCount).toBe(4)
    expect(placement?.text.split("\n")).toEqual([
      "二つ目の式で",
      "符号を取り違",
      "えて計算して",
      "いる",
    ])
    expect(placement && toCell(placement, inkGrid)).toEqual({
      column: 41,
      row: ROW_COUNT - 4 * LINE_ROW_SPAN,
    })
  })

  it("下の帯だけ空いていれば、その帯に置く", () => {
    // 上 20行に記入。膨らませると 20行目も埋まるので、空きは 21〜29行
    const inkGrid = createInkGrid((_, row) => row < 20)
    const placement = place("単位がない答えである", inkGrid)

    expect(placement?.overlapsInk).toBe(false)
    expect(placement?.lineCount).toBe(1)
    expect(placement && toCell(placement, inkGrid)).toEqual({
      column: 0,
      row: ROW_COUNT - LINE_ROW_SPAN,
    })
  })

  it("上にも下にも空きがあれば、書き終わりの下に置く", () => {
    const inkGrid = createInkGrid((_, row) => row >= 10 && row <= 12)
    const placement = place("途中式がない", inkGrid)

    expect(placement && toCell(placement, inkGrid).row).toBe(
      ROW_COUNT - LINE_ROW_SPAN
    )
  })

  it("注釈文の $ と改行を取り除く", () => {
    const placement = place(
      "$x^2$ の係数\nが違う",
      createInkGrid(() => false)
    )

    expect(placement?.text).toBe("x^2 の係数が違う")
  })

  it("$ を除いて何も残らなければ null", () => {
    expect(
      place(
        "$$",
        createInkGrid(() => false)
      )
    ).toBeNull()
  })
})

describe("wrapAnnotationText", () => {
  it("行頭禁則の文字は前の1文字と一緒に次の行へ送る", () => {
    expect(wrapAnnotationText("あいうえ。かきく", 4)).toEqual([
      "あいう",
      "え。かき",
      "く",
    ])
  })

  it("行末禁則の文字は次の行へ送る", () => {
    expect(wrapAnnotationText("あいう「えお」", 4)).toEqual([
      "あいう",
      "「えお」",
    ])
  })

  it("閉じ括弧と句点が続いても行頭に置かない", () => {
    expect(wrapAnnotationText("あいうえ」。か", 4)).toEqual([
      "あいう",
      "え」。か",
    ])
  })

  it("半角文字は全角の 0.55 として数える", () => {
    // 0.55 × 7 = 3.85 ≤ 4
    expect(wrapAnnotationText("abcdefgh", 4)).toEqual(["abcdefg", "h"])
  })
})

describe("sanitizeAnnotationText", () => {
  it("$ と改行を取り除き、前後の空白を落とす", () => {
    expect(sanitizeAnnotationText(" $a$ と\r\n$b$ ")).toBe("a とb")
  })
})
