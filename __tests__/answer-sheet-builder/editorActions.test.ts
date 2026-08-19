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
import type {
  AnswerSheetDefinition,
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
    const { result } = renderHook(() =>
      useAnswerSheetDefinition(twoMajorsWithTwoSubs())
    )

    act(() => {
      result.current.actions.updateSubQuestion("sub-2a", { points: 7 })
    })

    expect(findSubQuestion(result.current.definition, "sub-2a").points).toBe(7)
    expect(findSubQuestion(result.current.definition, "sub-1a").points).toBe(1)
  })

  it("触っていない大問は、参照ごと残る（作り直さない）", () => {
    const { result } = renderHook(() =>
      useAnswerSheetDefinition(twoMajorsWithTwoSubs())
    )
    const untouched = result.current.definition.majorQuestions[1]

    act(() => {
      result.current.actions.updateSubQuestion("sub-1a", { points: 3 })
    })

    expect(result.current.definition.majorQuestions[1]).toBe(untouched)
  })

  it("小問を消しても、別の大問の同じ位置の小問は残る", () => {
    const { result } = renderHook(() =>
      useAnswerSheetDefinition(twoMajorsWithTwoSubs())
    )

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
    const { result } = renderHook(() =>
      useAnswerSheetDefinition(twoMajorsWithTwoSubs())
    )

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
  it("原稿用紙の列数を変えても、文字位置マーカーは残る", () => {
    const definition = twoMajorsWithTwoSubs()
    const { result } = renderHook(() => useAnswerSheetDefinition(definition))

    act(() => {
      result.current.actions.updateSubQuestion("sub-1a", {
        manuscriptPaper: { enabled: true },
      })
    })
    act(() => {
      result.current.actions.addCharGuide("sub-1a", {
        id: "guide-1",
        atChar: 80,
        label: "80",
      })
    })
    act(() => {
      result.current.actions.updateSubQuestion("sub-1a", {
        manuscriptPaper: { columns: 25 },
      })
    })

    const subQuestion = findSubQuestion(result.current.definition, "sub-1a")
    expect(subQuestion.manuscriptPaper?.columns).toBe(25)
    expect(subQuestion.manuscriptPaper?.enabled).toBe(true)
    expect(
      subQuestion.manuscriptPaper?.charGuides?.map((charGuide) => charGuide.id)
    ).toEqual(["guide-1"])
  })

  it("セルにテキスト要素を足しても、別のセルの中身は変わらない", () => {
    const { result } = renderHook(() =>
      useAnswerSheetDefinition(twoMajorsWithTwoSubs())
    )

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
    const { result } = renderHook(() =>
      useAnswerSheetDefinition(twoMajorsWithTwoSubs())
    )

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
    const { result } = renderHook(() =>
      useAnswerSheetDefinition(createDefaultDefinition())
    )

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
