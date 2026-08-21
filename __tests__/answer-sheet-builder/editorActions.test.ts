// @vitest-environment jsdom
/**
 * 解答用紙の編集操作が「id で指した実体だけ」を変えることの検証。
 *
 * 以前は添字（大問の何番目・小問の何番目）で指していた。添字は並べ替えや削除でずれる
 * うえ、そのままプロセス境界を越えて「どの行を書くか」の決定に使われる。ここでは
 * **同じ位置に別の実体が居ても取り違えない**ことと、**更新に子のまとまりが紛れ込まない**
 * ことを固定する。
 */

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useAnswerSheetDefinition } from "@/components/answer-sheet-builder/hooks/useAnswerSheetDefinition"
import type { AsbEditorActions } from "@/components/answer-sheet-builder/types"
import type {
  AnswerSheetDefinition,
  AnswerSheetEditAction,
  AsbCellParent,
  AsbManuscriptPaperAttributes,
  SubQuestion,
} from "@/types/answerSheetDefinition.types"

import { createDefaultDefinition } from "../../src/components/answer-sheet-builder/constants"

/** 大問2つ・それぞれに小問2つ、という同じ形を2つ並べた解答用紙 */
function twoMajorsWithTwoSubs(): AnswerSheetDefinition {
  const base = createDefaultDefinition()
  const subQuestion = base.majorQuestions[0].subQuestions[0]
  const makeSub = (id: string, label: string): SubQuestion => ({
    ...subQuestion,
    id,
    label,
    branchQuestions: [],
    textElements: [],
    imageElements: [],
  })
  return {
    ...base,
    majorQuestions: [
      {
        id: "major-1",
        label: "1",
        subQuestions: [makeSub("sub-1a", "(1)"), makeSub("sub-1b", "(2)")],
      },
      {
        id: "major-2",
        label: "2",
        subQuestions: [makeSub("sub-2a", "(1)"), makeSub("sub-2b", "(2)")],
      },
    ],
  }
}

/**
 * 編集フックを、**書き込みへ渡った意図を控えながら**動かす。
 *
 * フック自身は DB を触らない。編集1つにつき `onEdit` が1回呼ばれ、それがそのまま
 * 1レコードの書き込みになる。
 */
function renderEditor(initial: AnswerSheetDefinition) {
  const edits: AnswerSheetEditAction[] = []
  const restored: AnswerSheetDefinition[] = []
  const rendered = renderHook(() =>
    useAnswerSheetDefinition({
      initial,
      onEdit: (action) => edits.push(action),
      onRestore: (definition) => restored.push(definition),
    })
  )
  return { ...rendered, edits, restored }
}

function findSubQuestion(
  definition: AnswerSheetDefinition,
  subQuestionId: string
): SubQuestion {
  const found = definition.majorQuestions
    .flatMap((majorQuestion) => majorQuestion.subQuestions)
    .find((subQuestion) => subQuestion.id === subQuestionId)
  if (!found) throw new Error(`小問 ${subQuestionId} が無い`)
  return found
}

describe("編集操作は id で指した実体だけを変える", () => {
  it("同じ位置にいる別の大問の小問は巻き添えにしない", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())

    act(() => {
      result.current.actions.updateSubQuestion("sub-2a", { points: 7 })
    })

    expect(findSubQuestion(result.current.definition, "sub-2a").points).toBe(7)
    expect(findSubQuestion(result.current.definition, "sub-1a").points).toBe(1)
  })

  it("触っていない大問は、参照ごと残る（作り直さない）", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())
    const untouched = result.current.definition.majorQuestions[1]

    act(() => {
      result.current.actions.updateSubQuestion("sub-1a", { points: 3 })
    })

    expect(result.current.definition.majorQuestions[1]).toBe(untouched)
  })

  it("小問を消しても、別の大問の同じ位置の小問は残る", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())

    act(() => {
      result.current.actions.deleteSubQuestion("sub-1a")
    })

    const remaining = result.current.definition.majorQuestions.map(
      (majorQuestion) =>
        majorQuestion.subQuestions.map((subQuestion) => subQuestion.id)
    )
    expect(remaining).toEqual([["sub-1b"], ["sub-2a", "sub-2b"]])
  })

  it("並べ替えは id の並びで指す", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())

    act(() => {
      result.current.actions.reorderSubQuestions("major-1", [
        "sub-1b",
        "sub-1a",
      ])
    })

    expect(
      result.current.definition.majorQuestions[0].subQuestions.map(
        (subQuestion) => subQuestion.id
      )
    ).toEqual(["sub-1b", "sub-1a"])
    // もう一方の大問は触っていないので参照ごと残る
    expect(
      result.current.definition.majorQuestions[1].subQuestions.map(
        (subQuestion) => subQuestion.id
      )
    ).toEqual(["sub-2a", "sub-2b"])
  })
})

describe("更新に子のまとまりが紛れ込まない", () => {
  /** 原稿用紙を有効にして、文字位置マーカーを1つ置く */
  function givenManuscriptPaper(
    result: {
      current: { actions: AsbEditorActions; definition: AnswerSheetDefinition }
    },
    parent: AsbCellParent,
    data: Partial<AsbManuscriptPaperAttributes>
  ): string {
    act(() => {
      result.current.actions.upsertManuscriptPaper(parent, {
        enabled: true,
        ...data,
      })
    })
    const cellId =
      "subQuestionId" in parent ? parent.subQuestionId : parent.branchQuestionId
    const manuscriptPaperId = findSubQuestion(result.current.definition, cellId)
      .manuscriptPaper?.id
    if (!manuscriptPaperId) throw new Error("原稿用紙ができていない")
    act(() => {
      result.current.actions.addCharGuide(manuscriptPaperId, {
        id: "guide-1",
        atChar: 80,
        label: "80",
      })
    })
    return manuscriptPaperId
  }

  it("原稿用紙の列数を変えても、文字位置マーカーは残る", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())
    const cell = { subQuestionId: "sub-1a" }
    givenManuscriptPaper(result, cell, {})

    act(() => {
      result.current.actions.upsertManuscriptPaper(cell, { columns: 25 })
    })

    const subQuestion = findSubQuestion(result.current.definition, "sub-1a")
    expect(subQuestion.manuscriptPaper?.columns).toBe(25)
    expect(subQuestion.manuscriptPaper?.enabled).toBe(true)
    expect(
      subQuestion.manuscriptPaper?.charGuides.map((charGuide) => charGuide.id)
    ).toEqual(["guide-1"])
  })

  it("ラベルだけを変えても、原稿用紙は残る", () => {
    // 原稿用紙が小問の属性の中の入れ子だった頃は、更新のたびに手で1段深く重ね直して
    // いた。その重ね直しを `&&` で書くと**原稿用紙と無関係な更新**のときに undefined に
    // なり、設定ごと消えた（docs/branch-review-findings.md #1）。原稿用紙をテーブルへ
    // 出したいまは、小問の属性に原稿用紙が入らないので混ざりようがない。
    const { result, edits } = renderEditor(twoMajorsWithTwoSubs())
    const cell = { subQuestionId: "sub-1a" }
    const manuscriptPaperId = givenManuscriptPaper(result, cell, {
      columns: 25,
      rows: 15,
    })

    // 原稿用紙に触らない更新（ラベルを1文字打つ）
    act(() => {
      result.current.actions.updateSubQuestion("sub-1a", { label: "(1)改" })
    })

    const subQuestion = findSubQuestion(result.current.definition, "sub-1a")
    expect(subQuestion.label).toBe("(1)改")
    expect(subQuestion.manuscriptPaper?.id).toBe(manuscriptPaperId)
    expect(subQuestion.manuscriptPaper?.enabled).toBe(true)
    expect(subQuestion.manuscriptPaper?.columns).toBe(25)
    expect(subQuestion.manuscriptPaper?.rows).toBe(15)
    expect(
      subQuestion.manuscriptPaper?.charGuides.map((charGuide) => charGuide.id)
    ).toEqual(["guide-1"])

    // DB へ行くのは意図のほう。小問の更新が原稿用紙のテーブルへ届かないこと
    const lastEdit = edits[edits.length - 1]
    if (lastEdit.type !== "UPDATE_SUB_QUESTION") throw new Error("種類が違う")
    expect(Object.keys(lastEdit.payload.attributes)).not.toContain(
      "manuscriptPaper"
    )
  })

  it("枝問にも原稿用紙を付けられ、小問側には作られない", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())
    act(() => {
      result.current.actions.addBranchQuestion("sub-1a")
    })
    const branchQuestion = findSubQuestion(result.current.definition, "sub-1a")
      .branchQuestions[0]

    act(() => {
      result.current.actions.upsertManuscriptPaper(
        { branchQuestionId: branchQuestion.id },
        { enabled: true, columns: 25, rows: 4 }
      )
    })

    const subQuestion = findSubQuestion(result.current.definition, "sub-1a")
    expect(subQuestion.manuscriptPaper).toBeUndefined()
    expect(subQuestion.branchQuestions[0].manuscriptPaper).toMatchObject({
      enabled: true,
      columns: 25,
      rows: 4,
    })
  })

  it("原稿用紙をオフにしても、設定と文字位置マーカーは残る", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())
    const cell = { subQuestionId: "sub-1a" }
    givenManuscriptPaper(result, cell, { columns: 25, rows: 15 })

    act(() => {
      result.current.actions.upsertManuscriptPaper(cell, { enabled: false })
    })

    const subQuestion = findSubQuestion(result.current.definition, "sub-1a")
    expect(subQuestion.manuscriptPaper?.enabled).toBe(false)
    expect(subQuestion.manuscriptPaper?.columns).toBe(25)
    expect(subQuestion.manuscriptPaper?.rows).toBe(15)
    expect(subQuestion.manuscriptPaper?.charGuides).toHaveLength(1)
  })

  it("セルにテキスト要素を足しても、別のセルの中身は変わらない", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())

    act(() => {
      result.current.actions.addTextElement({ subQuestionId: "sub-1a" })
    })

    expect(
      findSubQuestion(result.current.definition, "sub-1a").textElements
    ).toHaveLength(1)
    expect(
      findSubQuestion(result.current.definition, "sub-1b").textElements
    ).toHaveLength(0)
  })

  it("テキスト要素は、どのセルにあっても id で引いて消せる", () => {
    const { result } = renderEditor(twoMajorsWithTwoSubs())

    act(() => {
      result.current.actions.addTextElement({ subQuestionId: "sub-2b" })
    })
    const textElement = findSubQuestion(result.current.definition, "sub-2b")
      .textElements[0]

    act(() => {
      result.current.actions.deleteTextElement(textElement.id)
    })

    expect(
      findSubQuestion(result.current.definition, "sub-2b").textElements
    ).toHaveLength(0)
  })
})

describe("ヘッダー項目", () => {
  it("並べ替えると、並びの位置が order へ写る", () => {
    const { result } = renderEditor(createDefaultDefinition())

    act(() => {
      result.current.actions.addHeaderField({ label: "受験番号" })
    })
    act(() => {
      result.current.actions.addHeaderField({ label: "氏名" })
    })
    const [first, second] = result.current.definition.settings.headerFields

    act(() => {
      result.current.actions.reorderHeaderFields([second.id, first.id])
    })

    expect(
      result.current.definition.settings.headerFields.map((headerField) => [
        headerField.label,
        headerField.order,
      ])
    ).toEqual([
      ["氏名", 0],
      ["受験番号", 1],
    ])
  })
})

describe("編集は書き込みの意図として渡る", () => {
  it("小問の一部を触っても、渡るのは属性ひとそろい（子は載らない）", () => {
    const { result, edits } = renderEditor(twoMajorsWithTwoSubs())

    act(() => {
      result.current.actions.updateSubQuestion("sub-1a", { points: 7 })
    })

    expect(edits).toHaveLength(1)
    const [edit] = edits
    if (edit.type !== "UPDATE_SUB_QUESTION") throw new Error("種類が違う")
    expect(edit.payload.subQuestionId).toBe("sub-1a")
    // 触っていない属性も載る（1レコードの列を書くのが書き込みの単位）
    expect(edit.payload.attributes.points).toBe(7)
    expect(edit.payload.attributes.label).toBe("(1)")
    // 子のまとまりは載らない
    expect(edit.payload.attributes).not.toHaveProperty("branchQuestions")
    expect(edit.payload.attributes).not.toHaveProperty("textElements")
    expect(edit.payload.attributes).not.toHaveProperty("id")
  })

  it("隣とぶつかる配置は、隣の分も別の意図として渡る", () => {
    // 「この後で改行」と「N行上に戻す」は両立しない。降ろす先は別のレコードなので、
    // 1つの更新に混ぜると、その隣を DB へ書く経路が無くなる
    const definition = twoMajorsWithTwoSubs()
    definition.majorQuestions[0].subQuestions[1].goUp = 1
    const { result, edits } = renderEditor(definition)

    act(() => {
      result.current.actions.updateSubQuestion("sub-1a", {
        nextPlacement: "break",
      })
    })

    expect(
      edits.map((edit) =>
        edit.type === "UPDATE_SUB_QUESTION" ? edit.payload.subQuestionId : null
      )
    ).toEqual(["sub-1b", "sub-1a"])
    expect(
      findSubQuestion(result.current.definition, "sub-1b").goUp
    ).toBeUndefined()
    expect(
      findSubQuestion(result.current.definition, "sub-1a").nextPlacement
    ).toBe("break")
  })

  it("番号の既定は、どの実体がどのラベルになるかまで決めて渡る", () => {
    const { result, edits } = renderEditor(twoMajorsWithTwoSubs())

    act(() => {
      result.current.actions.applyLabelPreset("major", "1,2,3,4")
    })

    const [edit] = edits
    if (edit.type !== "APPLY_LABEL_PRESET") throw new Error("種類が違う")
    expect(edit.payload.relabeled).toEqual([
      { id: "major-1", label: "1" },
      { id: "major-2", label: "2" },
    ])
  })

  it("元に戻すのは意図ではなく、戻した先の姿がそのまま渡る", () => {
    const { result, edits, restored } = renderEditor(twoMajorsWithTwoSubs())

    act(() => {
      result.current.actions.updateSubQuestion("sub-1a", { points: 7 })
    })
    act(() => {
      result.current.undo()
    })

    // undo そのものは編集の意図として渡らない（対応する1レコードの書き込みが無い）
    expect(edits).toHaveLength(1)
    expect(restored).toHaveLength(1)
    expect(findSubQuestion(restored[0], "sub-1a").points).toBe(1)
    expect(findSubQuestion(result.current.definition, "sub-1a").points).toBe(1)
  })
})
