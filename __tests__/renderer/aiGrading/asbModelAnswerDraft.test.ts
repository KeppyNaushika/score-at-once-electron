/**
 * 解答用紙（ASB）からの模範解答の下書き（docs/vlm-grading-design.md §2）。
 *
 * ラベルは試験を作るときと同じ形（`大問-小問`・`大問-小問-枝問`、小問が無名なら大問だけ）で
 * 突き合わせ、`||…||` の中身だけを抜き出す。
 */

import { describe, expect, it } from "vitest"

import type { AsbModelAnswerSource } from "@/components/exams/07-score-at-once/AiGrading/types"
import {
  draftModelAnswerFromAsb,
  extractModelAnswerText,
} from "@/components/exams/07-score-at-once/AiGrading/utils/asbModelAnswerDraft"

const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")

function textElement(id: string, text: string) {
  return {
    id,
    subQuestionId: null,
    branchQuestionId: null,
    text,
    fontSize: 10,
    horizontalAlign: "left",
    verticalAlign: "top",
    order: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  }
}

function questionBase(id: string, label: string) {
  return {
    id,
    label,
    order: 0,
    heightMultiplier: 1,
    points: 2,
    layoutWidth: null,
    nextPlacement: null,
    goUp: null,
    borderStyleTop: null,
    borderStyleBottom: null,
    borderStyleLeft: null,
    borderStyleRight: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  }
}

/** 大問「1」に、小問「(1)」（枝問 ア・イ）と無名の小問を持つ解答用紙 */
function buildSource(): Pick<AsbModelAnswerSource, "majorQuestions"> {
  const majorQuestion = {
    id: "major-1",
    definitionId: "definition-1",
    label: "1",
    order: 0,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  }
  return {
    majorQuestions: [
      {
        ...majorQuestion,
        subQuestions: [
          {
            ...questionBase("sub-1", "(1)"),
            majorQuestionId: "major-1",
            usesBranchPoints: true,
            textElements: [textElement("t-sub", "答え ||x = 2|| です")],
            branchQuestions: [
              {
                ...questionBase("branch-a", "ア"),
                subQuestionId: "sub-1",
                textElements: [
                  textElement("t-a", "||$\\frac{1}{2}$|| と ||**3**||"),
                ],
              },
            ],
          },
          {
            ...questionBase("sub-2", ""),
            majorQuestionId: "major-1",
            usesBranchPoints: null,
            textElements: [textElement("t-plain", "模範解答なし")],
            branchQuestions: [],
          },
        ],
      },
    ],
  }
}

describe("extractModelAnswerText", () => {
  it("||…|| の中身だけを抜き出し、数式は $ に戻し、離れたものは改行でつなぐ", () => {
    expect(extractModelAnswerText("答え ||x = 2|| です")).toBe("x = 2")
    expect(extractModelAnswerText("||$\\frac{1}{2}$|| と ||**3**||")).toBe(
      "$\\frac{1}{2}$\n3"
    )
    expect(extractModelAnswerText("模範解答なし")).toBe("")
  })
})

describe("draftModelAnswerFromAsb", () => {
  it("小問のラベル（大問-小問）なら、小問と枝問の模範解答をまとめて返す", () => {
    expect(draftModelAnswerFromAsb(buildSource(), "1-(1)")).toEqual({
      matchedLabel: "1-(1)",
      modelAnswerText: "x = 2\n$\\frac{1}{2}$\n3",
    })
  })

  it("枝問のラベル（大問-小問-枝問）なら、その枝問だけ", () => {
    expect(
      draftModelAnswerFromAsb(buildSource(), "1-(1)-ア")?.modelAnswerText
    ).toBe("$\\frac{1}{2}$\n3")
  })

  it("無名の小問は大問のラベルだけで当たり、模範解答が無ければ空文字", () => {
    expect(draftModelAnswerFromAsb(buildSource(), "1")).toEqual({
      matchedLabel: "1",
      modelAnswerText: "",
    })
  })

  it("当たらなければ null（ラベルは 03 で直されうる）", () => {
    expect(draftModelAnswerFromAsb(buildSource(), "2-(1)")).toBeNull()
    expect(draftModelAnswerFromAsb(buildSource(), "")).toBeNull()
  })
})
