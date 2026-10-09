/**
 * 項目の助言から朱書きの文を決める規則と、朱書きの差分（docs/vlm-grading-design.md §4-7）。
 *
 * ここで固定すること:
 * - 助言のある項目が0なら朱書きなし、1つならその助言、2つ以上なら項目の集合の決まりに従う
 *   （決まりが無い・中身の欠けた決まりは未決定。同じ集合が2つあれば新しく直されたもの）
 * - 決まり: まとめた一文／1つの項目の助言だけ／すべて並べる（項目の並び順に段落）／なし
 * - 差分: 印の付いた朱書きだけを比べ、作る・文だけを書き換える（位置は保つ）・消す。
 *   折り返しの違いだけなら書き換えない。手で書いた注釈は消す先に入れない
 * - 未決定の組み合わせの洗い出しと、問いかけの選択肢の並び
 */

import { describe, expect, it } from "vitest"

import {
  listAdviceOptions,
  optionIndexOfRule,
  toAdviceChoiceOfOption,
} from "@/components/exams/07-score-at-once/Rubric/utils/rubricAdviceOptions"
import {
  type AdviceSyncRow,
  isEmptyAdviceSyncPlan,
  planRubricAdviceSync,
} from "@/components/exams/07-score-at-once/Rubric/utils/rubricAdviceSync"
import {
  type AdviceCombinationRule,
  adviceItemIdsOf,
  type AdviceRubricItem,
  adviceTextOfChoice,
  findAdviceCombination,
  findUndecidedAdviceCombinations,
  resolveRubricAdvice,
} from "@/components/exams/07-score-at-once/Rubric/utils/rubricAdviceText"
import {
  type DrawingAnnotation,
  newDrawingAnnotation,
} from "@/types/drawingAnnotation.types"

const unit: AdviceRubricItem = {
  id: "item-unit",
  label: "単位が無い",
  adviceText: "単位を書こう",
}
const sign: AdviceRubricItem = {
  id: "item-sign",
  label: "符号の誤り",
  adviceText: "移項の符号を見直そう",
}
const process: AdviceRubricItem = {
  id: "item-process",
  label: "途中式が無い",
  adviceText: "途中式を書こう",
}
/** 助言の無い項目（朱書きは作らない） */
const exemplary: AdviceRubricItem = {
  id: "item-exemplary",
  label: "模範解答どおり",
  adviceText: "  ",
}
const rubricItems = [unit, sign, process, exemplary]

function makeRule(
  overrides: Partial<AdviceCombinationRule> & { itemIds: string[] }
): AdviceCombinationRule {
  const { itemIds, ...rest } = overrides
  return {
    id: `rule-${itemIds.join("-")}`,
    mode: "all",
    mergedText: "",
    primaryRubricItemId: null,
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    items: itemIds.map((rubricItemId) => ({ rubricItemId })),
    ...rest,
  }
}

describe("朱書きの文の決まり方", () => {
  it("助言のある項目だけを、項目の並び順で数える（消えた項目は数えない）", () => {
    expect(
      adviceItemIdsOf(
        ["item-process", "item-exemplary", "item-unit", "item-gone"],
        rubricItems
      )
    ).toEqual(["item-unit", "item-process"])
  })

  it("助言のある項目が無ければなし、1つならその助言", () => {
    expect(resolveRubricAdvice(["item-exemplary"], rubricItems, [])).toEqual({
      kind: "none",
    })
    expect(
      resolveRubricAdvice(["item-exemplary", "item-unit"], rubricItems, [])
    ).toEqual({ kind: "text", text: "単位を書こう" })
  })

  it("2つ以上で決まりが無ければ未決定", () => {
    expect(
      resolveRubricAdvice(["item-sign", "item-unit"], rubricItems, [])
    ).toEqual({ kind: "undecided", itemIds: ["item-unit", "item-sign"] })
  })

  it("決まりの4つの扱い（集合の並びは問わない）", () => {
    const applied = ["item-sign", "item-unit"]
    const resolveWith = (rule: AdviceCombinationRule) =>
      resolveRubricAdvice(applied, rubricItems, [rule])
    expect(
      resolveWith(
        makeRule({
          itemIds: ["item-unit", "item-sign"],
          mode: "merged",
          mergedText: "符号と単位を見直そう",
        })
      )
    ).toEqual({ kind: "text", text: "符号と単位を見直そう" })
    expect(
      resolveWith(
        makeRule({
          itemIds: ["item-sign", "item-unit"],
          mode: "single",
          primaryRubricItemId: "item-sign",
        })
      )
    ).toEqual({ kind: "text", text: "移項の符号を見直そう" })
    expect(
      resolveWith(
        makeRule({ itemIds: ["item-unit", "item-sign"], mode: "all" })
      )
    ).toEqual({ kind: "text", text: "単位を書こう\n移項の符号を見直そう" })
    expect(
      resolveWith(
        makeRule({ itemIds: ["item-unit", "item-sign"], mode: "none" })
      )
    ).toEqual({ kind: "none" })
  })

  it("集合が違う決まりは使わない。中身の欠けた決まりは未決定と同じ", () => {
    const applied = ["item-unit", "item-sign"]
    expect(
      resolveRubricAdvice(applied, rubricItems, [
        makeRule({ itemIds: ["item-unit", "item-sign", "item-process"] }),
      ]).kind
    ).toBe("undecided")
    expect(
      resolveRubricAdvice(applied, rubricItems, [
        makeRule({
          itemIds: ["item-unit", "item-sign"],
          mode: "single",
          primaryRubricItemId: "item-process",
        }),
      ]).kind
    ).toBe("undecided")
    expect(
      resolveRubricAdvice(applied, rubricItems, [
        makeRule({
          itemIds: ["item-unit", "item-sign"],
          mode: "merged",
          mergedText: " ",
        }),
      ]).kind
    ).toBe("undecided")
  })

  it("同じ集合の決まりが2つあれば、新しく直されたものを採る", () => {
    const older = makeRule({
      itemIds: ["item-unit", "item-sign"],
      id: "older",
      mode: "none",
      updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    })
    const newer = makeRule({
      itemIds: ["item-sign", "item-unit"],
      id: "newer",
      mode: "all",
      updatedAt: new Date("2026-10-02T00:00:00.000Z"),
    })
    expect(
      findAdviceCombination(["item-unit", "item-sign"], [newer, older])?.id
    ).toBe("newer")
    expect(
      findAdviceCombination(["item-unit", "item-sign"], [older, newer])?.id
    ).toBe("newer")
  })

  it("並べるとき、助言の無い項目は飛ばす", () => {
    expect(
      adviceTextOfChoice(
        { mode: "all" },
        ["item-unit", "item-exemplary", "item-process"],
        rubricItems
      )
    ).toBe("単位を書こう\n途中式を書こう")
  })
})

describe("未決定の組み合わせ", () => {
  it("同じ組み合わせの答案を1つにまとめ、決まりのあるもの・助言が1つ以下のものは出さない", () => {
    const cell = (examStudentId: string, itemIds: string[]) => ({
      examStudentId,
      appliedItemIds: new Set(itemIds),
    })
    const undecided = findUndecidedAdviceCombinations(
      [
        cell("s1", ["item-sign", "item-unit"]),
        cell("s2", ["item-unit", "item-sign", "item-exemplary"]),
        cell("s3", ["item-unit"]),
        cell("s4", ["item-sign", "item-process"]),
        cell("s5", ["item-unit", "item-process"]),
      ],
      rubricItems,
      [makeRule({ itemIds: ["item-unit", "item-process"] })]
    )
    expect(undecided).toEqual([
      { itemIds: ["item-unit", "item-sign"], examStudentIds: ["s1", "s2"] },
      { itemIds: ["item-sign", "item-process"], examStudentIds: ["s4"] },
    ])
  })
})

describe("問いかけの選択肢", () => {
  it("まとめた一文 → 項目ごとの助言だけ → すべて並べる → 朱書きなし の順", () => {
    const options = listAdviceOptions(["item-unit", "item-sign"])
    expect(options).toEqual([
      { kind: "merged" },
      { kind: "single", rubricItemId: "item-unit" },
      { kind: "single", rubricItemId: "item-sign" },
      { kind: "all" },
      { kind: "none" },
    ])
    expect(toAdviceChoiceOfOption(options[0], "一文")).toEqual({
      mode: "merged",
      mergedText: "一文",
    })
    expect(toAdviceChoiceOfOption(options[2], "")).toEqual({
      mode: "single",
      primaryRubricItemId: "item-sign",
    })
  })

  it("開いたときの焦点は今の決まりの選択肢（決まりが無ければ先頭）", () => {
    const options = listAdviceOptions(["item-unit", "item-sign"])
    expect(optionIndexOfRule(options, null)).toBe(0)
    expect(
      optionIndexOfRule(
        options,
        makeRule({
          itemIds: ["item-unit", "item-sign"],
          mode: "single",
          primaryRubricItemId: "item-sign",
        })
      )
    ).toBe(2)
    expect(
      optionIndexOfRule(
        options,
        makeRule({ itemIds: ["item-unit", "item-sign"], mode: "none" })
      )
    ).toBe(4)
  })
})

describe("朱書きの差分", () => {
  const adviceAnnotation = (
    id: string,
    text: string,
    overrides: Partial<DrawingAnnotation> = {}
  ) => ({
    ...newDrawingAnnotation({
      type: "text",
      x: 0.4,
      y: 0.3,
      text,
      isRubricAdvice: true,
    }),
    id,
    ...overrides,
  })

  function makeRow(
    id: string,
    itemIds: string[],
    drawingAnnotations: DrawingAnnotation[] = []
  ): AdviceSyncRow {
    return {
      id,
      examStudentId: `student-of-${id}`,
      rubricApplications: itemIds.map((rubricItemId) => ({ rubricItemId })),
      drawingAnnotations,
    }
  }

  /** 置き場所の代わり（どの行に何の文で置いたかを残す） */
  const placed: { rowId: string; text: string }[] = []
  const plan = (rows: AdviceSyncRow[], rules: AdviceCombinationRule[] = []) => {
    placed.length = 0
    return planRubricAdviceSync({
      rows,
      rubricItems,
      combinations: rules,
      place: (row, adviceText) => {
        placed.push({ rowId: row.id, text: adviceText })
        return adviceAnnotation(`new-${row.id}`, adviceText)
      },
      rewrap: (_row, _annotation, adviceText) => `【${adviceText}】`,
    })
  }

  it("助言の朱書きが無い行には作る。助言のある項目が無い行には作らない", () => {
    const result = plan([
      makeRow("score-1", ["item-unit"]),
      makeRow("score-2", ["item-exemplary"]),
    ])
    expect(placed).toEqual([{ rowId: "score-1", text: "単位を書こう" }])
    expect(result.creates).toEqual([
      { questionScoreId: "score-1", annotation: expect.anything() },
    ])
    expect(result.updates).toEqual([])
    expect(result.deletes).toEqual([])
  })

  it("文が変わったら、位置を変えずに文だけを書き換える（折り返しの違いだけなら書き換えない）", () => {
    const result = plan([
      makeRow(
        "score-1",
        ["item-unit"],
        [adviceAnnotation("advice-1", "単位を\n書こう")]
      ),
      makeRow(
        "score-2",
        ["item-unit"],
        [adviceAnnotation("advice-2", "単位を書きなさい")]
      ),
    ])
    expect(result.creates).toEqual([])
    expect(result.updates).toEqual([
      { drawingAnnotationId: "advice-2", text: "【単位を書こう】" },
    ])
    expect(result.deletes).toEqual([])
  })

  it("助言が無くなった・朱書きなし・未決定になった行の朱書きは消す", () => {
    const result = plan(
      [
        makeRow("score-1", [], [adviceAnnotation("advice-1", "単位を書こう")]),
        makeRow(
          "score-2",
          ["item-unit", "item-process"],
          [adviceAnnotation("advice-2", "単位を書こう")]
        ),
        makeRow(
          "score-3",
          ["item-unit", "item-sign"],
          [adviceAnnotation("advice-3", "単位を書こう")]
        ),
      ],
      [
        makeRule({
          itemIds: ["item-unit", "item-process"],
          mode: "none",
        }),
      ]
    )
    expect(result.deletes).toEqual(["advice-1", "advice-2", "advice-3"])
    expect(result.creates).toEqual([])
  })

  it("助言の朱書きが2つあれば古いものを残し、残りを消す", () => {
    const result = plan([
      makeRow(
        "score-1",
        ["item-unit"],
        [
          adviceAnnotation("advice-old", "単位を書こう"),
          adviceAnnotation("advice-dup", "単位を書こう"),
        ]
      ),
    ])
    expect(result.deletes).toEqual(["advice-dup"])
    expect(result.updates).toEqual([])
  })

  it("印の無い注釈（手で書いたもの）は、渡されても比べず消さない", () => {
    const handWritten = {
      ...newDrawingAnnotation({
        type: "text",
        x: 0.2,
        y: 0.2,
        text: "よく書けた",
      }),
      id: "hand-1",
    }
    const result = plan([makeRow("score-1", [], [handWritten])])
    expect(isEmptyAdviceSyncPlan(result)).toBe(true)
    const withAdvice = plan([makeRow("score-2", ["item-unit"], [handWritten])])
    expect(withAdvice.creates).toHaveLength(1)
    expect(withAdvice.deletes).toEqual([])
  })

  it("決まりを決めると、その組み合わせの行に決まりの文で作る", () => {
    const result = plan(
      [makeRow("score-1", ["item-unit", "item-sign"])],
      [
        makeRule({
          itemIds: ["item-unit", "item-sign"],
          mode: "merged",
          mergedText: "符号と単位を見直そう",
        }),
      ]
    )
    expect(placed).toEqual([{ rowId: "score-1", text: "符号と単位を見直そう" }])
    expect(result.creates).toHaveLength(1)
  })
})
