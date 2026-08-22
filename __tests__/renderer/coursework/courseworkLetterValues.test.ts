// @vitest-environment jsdom
/**
 * 試験外成績資料の評語（文字評価）の扱いの検査。
 *
 * ここで固定するのは「推測しない」こと。
 *
 * 1. **`A` と `a` は別の評語。** 大小文字を畳むのは「そう打ちたかったのだろう」
 *    という推測で、`a` を `A` として保存すると教員が打った文字が消える。
 * 2. **全角を黙って寄せない。** 寄せるかどうかは貼り付けのときに人へ尋ねる
 *    （`containsFullWidth` / `toHalfWidth`）。承諾されるまでは寄せない。
 * 3. **変換表が0本のときは判定しない。** 変換表を作る前に全マスが赤くても
 *    直しようがない。
 * 4. **照合はそのままの比較。** 成績算出（`rawScoreCalculator` の
 *    `label === letterValue`）と同じ基準で数える。ここだけ緩めると、
 *    マスが赤くならないまま成績側で欠測になる。
 */

import { describe, expect, it } from "vitest"

import {
  collectUnknownLetterValues,
  containsFullWidth,
  isUnknownLetterValue,
  letterValueOf,
  toHalfWidth,
} from "@/components/coursework/courseworkLetterValues"
import type {
  CourseworkItemWithLetterScales,
  CourseworkScoreWithCourseworkStudent,
} from "@/types/coursework.types"

const AT = new Date("2026-08-01T00:00:00.000Z")

/** ラベルだけを与えて文字評価の評価項目を作る（点数は照合に関係しない） */
function letterItem(labels: string[]): CourseworkItemWithLetterScales {
  return {
    id: "item-1",
    courseworkId: "coursework-1",
    name: "提出物",
    order: 0,
    maxScore: 100,
    inputMode: "letter",
    createdAt: AT,
    updatedAt: AT,
    letterScales: labels.map((label, order) => ({
      id: `scale-${order}`,
      courseworkItemId: "item-1",
      label,
      score: 100 - order * 20,
      order,
    })),
  }
}

/** 1人分の点数（評語のみ） */
function letterScore(
  courseworkStudentId: string,
  letterValue: string | null
): CourseworkScoreWithCourseworkStudent {
  return {
    id: `score-${courseworkStudentId}`,
    courseworkItemId: "item-1",
    courseworkStudentId,
    score: null,
    letterValue,
    adjustment: null,
    adjustmentReason: null,
    comment: null,
    courseworkStudent: {
      id: courseworkStudentId,
      courseworkId: "coursework-1",
      studentId: `student-${courseworkStudentId}`,
      customOrder: null,
      createdAt: AT,
      updatedAt: AT,
      student: {
        id: `student-${courseworkStudentId}`,
        studentNumber: courseworkStudentId,
        lastName: "山田",
        firstName: "太郎",
      },
    },
  }
}

describe("letterValueOf", () => {
  it("前後の空白だけ落とし、文字はそのまま残す", () => {
    expect(letterValueOf("  A  ")).toBe("A")
    expect(letterValueOf("a")).toBe("a")
    expect(letterValueOf("Ａ")).toBe("Ａ")
    expect(letterValueOf("認定")).toBe("認定")
  })
})

describe("isUnknownLetterValue", () => {
  it("A と a を区別する（変換表に A だけあるとき a は一致しない）", () => {
    const item = letterItem(["A", "B", "C"])
    expect(isUnknownLetterValue(item, "A")).toBe(false)
    expect(isUnknownLetterValue(item, "a")).toBe(true)
  })

  it("全角の Ａ は、半角へ寄せて初めて A と一致する", () => {
    const item = letterItem(["A"])
    expect(isUnknownLetterValue(item, "Ａ")).toBe(true)
    expect(isUnknownLetterValue(item, toHalfWidth("Ａ"))).toBe(false)
  })

  it("変換表が0本なら判定しない（赤くしない）", () => {
    const item = letterItem([])
    expect(isUnknownLetterValue(item, "認定")).toBe(false)
    expect(isUnknownLetterValue(item, "A")).toBe(false)
  })

  it("空欄は未入力であって未定義の評語ではない", () => {
    const item = letterItem(["A"])
    expect(isUnknownLetterValue(item, "")).toBe(false)
    expect(isUnknownLetterValue(item, "   ")).toBe(false)
  })
})

describe("containsFullWidth / toHalfWidth", () => {
  it("全角の英数・記号を見つける", () => {
    expect(containsFullWidth("Ａ")).toBe(true)
    expect(containsFullWidth("１０")).toBe(true)
    expect(containsFullWidth("８．５")).toBe(true)
    expect(containsFullWidth("A\tB\n認定")).toBe(false)
  })

  it("承諾されたときだけ寄せる（関数を呼ばない限り何も変わらない）", () => {
    expect(toHalfWidth("Ａｂ１０－．")).toBe("Ab10-.")
    expect(toHalfWidth("認定")).toBe("認定")
  })
})

describe("collectUnknownLetterValues", () => {
  it("変換表に無い評語を、多い順に、件数つきで数える", () => {
    const item = letterItem(["A", "B"])
    const scores = [
      letterScore("cs-1", "A"),
      letterScore("cs-2", "認定"),
      letterScore("cs-3", "認定"),
      letterScore("cs-4", "b"),
      letterScore("cs-5", null),
    ]

    const unknown = collectUnknownLetterValues(item, scores)

    expect(unknown.values).toEqual(["認定", "b"])
    // 何人分あるかが分からないと、直すか放っておくかを決められない
    expect(unknown.count).toBe(3)
  })

  it("変換表に無い評語が無ければ0件（何も出さない）", () => {
    const item = letterItem(["A", "B"])
    const unknown = collectUnknownLetterValues(item, [
      letterScore("cs-1", "A"),
      letterScore("cs-2", "B"),
      letterScore("cs-3", null),
    ])

    expect(unknown.values).toEqual([])
    expect(unknown.count).toBe(0)
  })

  it("変換表が0本なら1件も挙げない（作る前の段階では判定しない）", () => {
    const item = letterItem([])
    const unknown = collectUnknownLetterValues(item, [
      letterScore("cs-1", "認定"),
      letterScore("cs-2", "A"),
    ])

    expect(unknown.values).toEqual([])
    expect(unknown.count).toBe(0)
  })
})
