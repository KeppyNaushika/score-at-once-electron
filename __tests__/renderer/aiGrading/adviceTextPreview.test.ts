/**
 * 問いかけの助言の欄の下見（docs/vlm-grading-design.md §3-5・§9）。
 *
 * ここで固定すること:
 * - 下見はいまの問いの答案だけに作る（ほかの答案は保存したまま）
 * - ほかの注釈は変えない。ほかの項目の助言の朱書きは保存したまま返し（手で書いた注釈は一覧がそのまま描く）、
 *   欄の文の朱書きを足す
 * - 答案の助言の朱書きの文が、案に当たる項目の今の助言と同じときだけ、その朱書きを欄の文に差し替える
 *   （今の位置・大きさで収まればそのまま、収まらなければ置き直す）。項目の無い案は差し替えない
 * - 足す・置き直す場所は、手で書いた文字の注釈とほかの助言の朱書きを避ける
 * - 欄が空なら、差し替える朱書きだけを隠し、ほかの助言の朱書きは残す
 *
 * 入力は合成した値だけ。
 */

import { describe, expect, it } from "vitest"

import { buildAdviceTextPreview } from "@/components/exams/07-score-at-once/AiGrading/utils/adviceTextPreview"
import { textAnnotationRectangleOf } from "@/components/exams/07-score-at-once/Rubric/utils/adviceAnnotationPlacement"
import type { NormalizedRectangle } from "@/lib/shared/aiGrading/annotationPlacement"
import {
  type DrawingAnnotation,
  newDrawingAnnotation,
} from "@/types/drawingAnnotation.types"

/** A4 縦の、用紙比の設問の枠（幅 105mm・高さ 59.4mm） */
const region = { x: 0.1, y: 0.1, width: 0.5, height: 0.2 }
const A4_PORTRAIT = { width: 210, height: 297 }

/** この案の項目の助言から作った朱書き */
const itemAdvice = newDrawingAnnotation({
  type: "text",
  x: region.x + 30 / 210,
  y: region.y + 20 / 297,
  text: "単位を書こう",
  fontSize: 5,
  isRubricAdvice: true,
})
/** ほかの項目の助言から作った朱書き（枠の左下。ふだん新しい朱書きを置くところ） */
const otherAdvice = newDrawingAnnotation({
  type: "text",
  x: region.x,
  y: region.y + 48 / 297,
  text: "途中式を書こう",
  fontSize: 5,
  isRubricAdvice: true,
})
/** 手で書いた文字の注釈（枠の左下） */
const handWritten = newDrawingAnnotation({
  type: "text",
  x: region.x,
  y: region.y + 48 / 297,
  text: "よく書けました",
  fontSize: 5,
})

const build = (
  adviceText: string,
  rubricItemAdviceText: string | null = "単位を書こう"
) =>
  buildAdviceTextPreview({
    request: {
      stepId: "proposal-1",
      adviceText,
      rubricItemAdviceText,
      examStudentIds: ["s-item", "s-other", "s-hand", "s-new"],
    },
    inkGridByExamStudentId: new Map(),
    savedAnnotationsByExamStudentId: new Map<string, DrawingAnnotation[]>([
      ["s-item", [handWritten, itemAdvice]],
      ["s-other", [otherAdvice]],
      ["s-hand", [handWritten]],
      ["s-outside", [itemAdvice]],
    ]),
    region,
    pageSize: "A4",
  })

/** 2つの矩形が重なるか（辺が接するだけなら重ならない） */
const intersects = (
  rectangleA: NormalizedRectangle,
  rectangleB: NormalizedRectangle
) =>
  rectangleA.x < rectangleB.x + rectangleB.width - 1e-9 &&
  rectangleB.x < rectangleA.x + rectangleA.width - 1e-9 &&
  rectangleA.y < rectangleB.y + rectangleB.height - 1e-9 &&
  rectangleB.y < rectangleA.y + rectangleA.height - 1e-9

const rectangleOf = (annotation: DrawingAnnotation) =>
  textAnnotationRectangleOf(annotation, A4_PORTRAIT)

/** 下見で足した（保存したものでない）朱書き */
const addedOf = (annotations: readonly DrawingAnnotation[] | undefined) =>
  (annotations ?? []).filter(
    (annotation) => annotation !== itemAdvice && annotation !== otherAdvice
  )

describe("助言の欄の下見", () => {
  it("いまの問いの答案だけに作り、この案の項目の朱書きは差し替える（収まれば位置と大きさを保つ）", () => {
    const preview = build("単位まで書こう")
    expect([...preview.keys()]).toEqual([
      "s-item",
      "s-other",
      "s-hand",
      "s-new",
    ])
    expect(preview.get("s-item")).toEqual([
      expect.objectContaining({
        text: "単位まで書こう",
        x: itemAdvice.x,
        y: itemAdvice.y,
        fontSize: 5,
        isRubricAdvice: true,
      }),
    ])
    expect(preview.get("s-new")).toEqual([
      expect.objectContaining({ text: "単位まで書こう", isRubricAdvice: true }),
    ])
  })

  it("ほかの項目の助言の朱書きは保存したまま残し、欄の文の朱書きを、それに重ならない場所へ足す", () => {
    const annotations = build("単位まで書こう").get("s-other") ?? []
    expect(annotations[0]).toBe(otherAdvice)
    const added = addedOf(annotations)
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ text: "単位まで書こう" })
    expect(intersects(rectangleOf(added[0]), rectangleOf(otherAdvice))).toBe(
      false
    )
  })

  it("手で書いた文字の注釈には重ねない（注釈は返さず、一覧が保存したまま描く）", () => {
    const annotations = build("単位まで書こう").get("s-hand") ?? []
    expect(annotations).toHaveLength(1)
    expect(annotations).not.toContain(handWritten)
    expect(
      intersects(rectangleOf(annotations[0]), rectangleOf(handWritten))
    ).toBe(false)
    // 何も無い答案では、同じ文が手で書いた注釈の場所（枠の左下）に置かれる
    const [onEmpty] = build("単位まで書こう").get("s-new") ?? []
    expect(intersects(rectangleOf(onEmpty), rectangleOf(handWritten))).toBe(
      true
    )
  })

  it("案に項目が無ければ、同じ文の朱書きがあっても差し替えず、足す", () => {
    const annotations = build("単位まで書こう", null).get("s-item") ?? []
    expect(annotations[0]).toBe(itemAdvice)
    const added = addedOf(annotations)
    expect(added).toHaveLength(1)
    expect(intersects(rectangleOf(added[0]), rectangleOf(itemAdvice))).toBe(
      false
    )
    expect(intersects(rectangleOf(added[0]), rectangleOf(handWritten))).toBe(
      false
    )
  })

  it("差し替える朱書きが今の位置で収まらなければ置き直す", () => {
    // 今の位置（枠の上から 20mm）・5mm の文字では、折り返すと枠の下を越える長さ
    const longText = "途中式も省かずに書いて、単位まで正しく書こう。".repeat(6)
    const [replaced] = build(longText).get("s-item") ?? []
    expect(replaced).toBeDefined()
    expect(
      replaced.x !== itemAdvice.x ||
        replaced.y !== itemAdvice.y ||
        replaced.fontSize !== itemAdvice.fontSize
    ).toBe(true)
  })

  it("欄が空なら、差し替える朱書きだけを隠し、ほかの助言の朱書きは残す", () => {
    const preview = build("  ")
    expect(preview.get("s-item")).toEqual([])
    expect(preview.get("s-other")).toEqual([otherAdvice])
    expect(preview.get("s-hand")).toEqual([])
    expect(preview.get("s-new")).toEqual([])
  })
})
