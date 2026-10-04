/**
 * 制約ルールの式（src/lib/constraintExpression.ts）の単体テスト
 *
 * 文法・日本語入力の受け付け・エラー表示・安全性（式から prototype や Function に
 * 届かないこと）を固定する。
 */

import { describe, expect, it } from "vitest"

import {
  evaluateExpression,
  type ExpressionFunctionTable,
  type ExpressionValue,
  parseExpression,
} from "@/lib/constraintExpression"

const FUNCTION_ARITY = { label: 1, has: 1, mean: null }

const LABELS: Record<string, string> = { 評定: "5", 態度: "A" }
const FUNCTIONS: ExpressionFunctionTable = {
  label: (name) => LABELS[String(name)] ?? "",
  has: (labelValue) => Object.values(LABELS).includes(String(labelValue)),
  mean: (...values) =>
    values.reduce<number>((acc, value) => acc + Number(value), 0) /
    values.length,
}

function run(expression: string): ExpressionValue {
  return evaluateExpression(
    parseExpression(expression, FUNCTION_ARITY),
    FUNCTIONS
  )
}

describe("constraintExpression: 文法", () => {
  it("演算子の優先順位（算術 > 比較 > not > and > or）", () => {
    expect(run("1 + 2 * 3 = 7")).toBe(true)
    expect(run("(1 + 2) * 3 = 9")).toBe(true)
    expect(run("-2 + 5 = 3")).toBe(true)
    expect(run("1 = 1 or 1 = 2 and 1 = 2")).toBe(true)
    expect(run("not 1 = 2 and 2 = 2")).toBe(true)
  })

  it("and / or / not は記号（&& / || / !）でも書け、大文字小文字を問わない", () => {
    expect(run('has("A") && has("5")')).toBe(true)
    expect(run('has("C") || has("A")')).toBe(true)
    expect(run('!has("C")')).toBe(true)
    expect(run('has("A") AND NOT has("C")')).toBe(true)
  })

  it("等しいは = でも == でもよく、≠ / <> / != は等しくない", () => {
    expect(run('label("態度") = "A"')).toBe(true)
    expect(run('label("態度") == "A"')).toBe(true)
    expect(run('label("態度") != "A"')).toBe(false)
    expect(run('label("態度") <> "B"')).toBe(true)
    expect(run('label("態度") ≠ "B"')).toBe(true)
  })

  it("数と数字の文字列は数として比べる", () => {
    expect(run('label("評定") = 5')).toBe(true)
    expect(run('label("評定") >= 4')).toBe(true)
    expect(run('label("評定") ≥ 5 and label("評定") ≤ 5')).toBe(true)
  })

  it("可変長の関数に引数を並べられる", () => {
    expect(run("mean(1, 2, 6) = 3")).toBe(true)
  })
})

describe("constraintExpression: 日本語入力のまま書ける", () => {
  it("全角の括弧・記号・数字・引用符を受け付ける", () => {
    expect(run("label（＂評定＂）＝５")).toBe(true)
    expect(run("label(“態度”) = “A”")).toBe(true)
    expect(run("ｈａｓ（＂Ａ＂）")).toBe(false) // 文字列の中は変換しない（項目名と突き合わせるため）
  })

  it("文字列を「」で囲める", () => {
    expect(run("label(「評定」) = 5")).toBe(true)
    expect(run("label（「態度」）＝「A」")).toBe(true)
  })
})

describe("constraintExpression: エラー", () => {
  const errorOf = (expression: string) => {
    try {
      parseExpression(expression, FUNCTION_ARITY)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  }

  it("無い関数は使える関数の一覧とともに知らせる", () => {
    expect(errorOf('lable("評定") = 5')).toContain("関数「lable」はありません")
    expect(errorOf('lable("評定") = 5')).toContain("label / has / mean")
  })

  it("引数の数の誤りを知らせる", () => {
    expect(errorOf('label("評定", "態度")')).toContain("引数は1つです")
  })

  it("閉じていない文字列・括弧を知らせる", () => {
    expect(errorOf('label("評定) = 5')).toContain("文字列が閉じていません")
    expect(errorOf('label("評定" = 5')).toContain("「)」が必要です")
  })

  it("演算子の抜けを位置つきで知らせる", () => {
    expect(errorOf('has("A") has("C")')).toContain("10文字目")
  })

  it("空の式・途中で終わる式はエラー", () => {
    expect(errorOf("")).not.toBeNull()
    expect(errorOf("has(")).not.toBeNull()
    expect(errorOf('has("A") and')).not.toBeNull()
  })

  it("数でない値の大小比較・計算は評価時にエラー", () => {
    expect(() => run('label("態度") > 3')).toThrow("数ではない")
    expect(() => run('label("態度") + 1')).toThrow("数ではない")
  })
})

describe("constraintExpression: 安全性", () => {
  it.each([
    "label.constructor",
    'label.constructor("return process")()',
    "label.__proto__",
    "label.call",
    'label["constructor"]',
    "constructor",
    "__proto__",
    "toString()",
    "hasOwnProperty()",
    "x = 1",
    "label.__proto__.polluted = 1",
  ])("%s は構文エラーになる", (expression) => {
    expect(() => parseExpression(expression, FUNCTION_ARITY)).toThrow()
  })

  it("関数表に無い名前は評価時にも呼ばない", () => {
    const tree = parseExpression("has(1)", { has: 1 })
    expect(() => evaluateExpression(tree, {})).toThrow("ありません")
  })

  it("Object.prototype を汚さない", () => {
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
