import { describe, expect, it } from "vitest"

import {
  hasModelAnswerContent,
  parseInlineMarkup,
  stripMarkup,
} from "@/lib/answer-sheet-builder/inlineMarkupParser"

describe("parseInlineMarkup", () => {
  it("空文字列で空配列を返す", () => {
    expect(parseInlineMarkup("")).toEqual([])
  })

  it("マークアップなしのプレーンテキストを返す", () => {
    expect(parseInlineMarkup("hello")).toEqual([{ text: "hello" }])
  })

  it("**text** を太字セグメントにパースする", () => {
    const result = parseInlineMarkup("前 **太字** 後")
    expect(result).toEqual([
      { text: "前 " },
      { text: "太字", bold: true },
      { text: " 後" },
    ])
  })

  it("*text* を斜体セグメントにパースする", () => {
    const result = parseInlineMarkup("前 *斜体* 後")
    expect(result).toEqual([
      { text: "前 " },
      { text: "斜体", italic: true },
      { text: " 後" },
    ])
  })

  it("__text__ を下線セグメントにパースする", () => {
    const result = parseInlineMarkup("__下線テスト__")
    expect(result).toEqual([{ text: "下線テスト", underline: true }])
  })

  it("~~text~~ を打消線セグメントにパースする", () => {
    const result = parseInlineMarkup("~~削除~~")
    expect(result).toEqual([{ text: "削除", strikethrough: true }])
  })

  it("$formula$ を数式セグメントにパースする", () => {
    const result = parseInlineMarkup("$x^2 + y = 0$")
    expect(result).toEqual([{ text: "x^2 + y = 0", math: true }])
  })

  it("||text|| を模範解答セグメントにパースする", () => {
    const result = parseInlineMarkup("||答え: 42||")
    expect(result).toEqual([{ text: "答え: 42", modelAnswer: true }])
  })

  it("ネストした書式をパースする: **bold *bold-italic* bold**", () => {
    const result = parseInlineMarkup("**太字 *太字斜体* 太字**")
    expect(result).toEqual([
      { text: "太字 ", bold: true },
      { text: "太字斜体", bold: true, italic: true },
      { text: " 太字", bold: true },
    ])
  })

  it("$...$ 内では他のマークアップを無視する", () => {
    const result = parseInlineMarkup("$**not bold**$")
    expect(result).toEqual([{ text: "**not bold**", math: true }])
  })

  it("閉じられていないデリミタはリテラルテキストとして扱う", () => {
    const result = parseInlineMarkup("**閉じない")
    expect(result).toEqual([{ text: "**閉じない" }])
  })

  it("複数の書式が混在するテキストをパースする", () => {
    const result = parseInlineMarkup("**太字** と *斜体* と ~~打消~~")
    expect(result).toEqual([
      { text: "太字", bold: true },
      { text: " と " },
      { text: "斜体", italic: true },
      { text: " と " },
      { text: "打消", strikethrough: true },
    ])
  })

  it("模範解答と通常テキストの混在", () => {
    const result = parseInlineMarkup("問題文 ||解答||")
    expect(result).toEqual([
      { text: "問題文 " },
      { text: "解答", modelAnswer: true },
    ])
  })

  it("模範解答内の太字", () => {
    const result = parseInlineMarkup("||**重要な解答**||")
    expect(result).toEqual([
      { text: "重要な解答", modelAnswer: true, bold: true },
    ])
  })

  it("数式と模範解答の組み合わせ", () => {
    const result = parseInlineMarkup("||$x = 5$||")
    expect(result).toEqual([{ text: "x = 5", math: true, modelAnswer: true }])
  })

  it("$$formula$$ を別行立て数式セグメントにパースする", () => {
    const result = parseInlineMarkup("$$x^2$$")
    expect(result).toEqual([{ text: "x^2", math: true, displayMath: true }])
  })

  it("$$...$$ 内では他のマークアップを無視する", () => {
    const result = parseInlineMarkup("$$**not bold**$$")
    expect(result).toEqual([
      { text: "**not bold**", math: true, displayMath: true },
    ])
  })

  it("$...$ と $$...$$ の混在", () => {
    const result = parseInlineMarkup("前 $a+b$ 中 $$\\frac{a}{b}$$ 後")
    expect(result).toEqual([
      { text: "前 " },
      { text: "a+b", math: true },
      { text: " 中 " },
      { text: "\\frac{a}{b}", math: true, displayMath: true },
      { text: " 後" },
    ])
  })

  it("閉じられていない $$ はリテラルテキストとして扱う", () => {
    const result = parseInlineMarkup("$$閉じない")
    expect(result).toEqual([{ text: "$$閉じない" }])
  })

  it("別行立て数式と模範解答の組み合わせ", () => {
    const result = parseInlineMarkup("||$$x = 5$$||")
    expect(result).toEqual([
      { text: "x = 5", math: true, displayMath: true, modelAnswer: true },
    ])
  })
})

describe("hasModelAnswerContent", () => {
  it("模範解答記法がある場合にtrueを返す", () => {
    expect(hasModelAnswerContent("||解答||")).toBe(true)
  })

  it("模範解答記法がない場合にfalseを返す", () => {
    expect(hasModelAnswerContent("通常テキスト")).toBe(false)
  })

  it("空の||の場合はfalseを返す", () => {
    expect(hasModelAnswerContent("||||")).toBe(false)
  })
})

describe("stripMarkup", () => {
  it("全てのマークアップを除去する", () => {
    expect(
      stripMarkup("**太字** *斜体* __下線__ ~~打消~~ $数式$ ||解答||")
    ).toBe("太字 斜体 下線 打消 数式 解答")
  })

  it("マークアップなしのテキストはそのまま返す", () => {
    expect(stripMarkup("プレーンテキスト")).toBe("プレーンテキスト")
  })

  it("$$...$$ を除去する", () => {
    expect(stripMarkup("前 $$x^2$$ 後")).toBe("前 x^2 後")
  })

  it("$...$ と $$...$$ が混在する場合に正しく除去する", () => {
    expect(stripMarkup("$a$ と $$b$$")).toBe("a と b")
  })
})
