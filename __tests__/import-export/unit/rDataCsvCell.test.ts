/**
 * R / exametrika 向け CSV のセルの書き方（`electron-src/lib/export/r-exametrika/csvCell.ts`）を縛る。
 *
 * - 表計算ソフトで数式として読まれうる先頭の文字列セルは `'` を前置して文字列にする
 * - 数値・数値として読める文字列はそのまま（R で数値の列として読めるように）
 * - 引用符・カンマ・改行（`\r` を含む）は引用する
 */
import { describe, expect, it } from "vitest"

import { csvCell } from "../../../electron-src/lib/export/r-exametrika/csvCell"

describe("csvCell: 数式として読まれうる文字列", () => {
  it.each(["=SUM(A1)", "+1+2", "-x", "@name", "\tname"])(
    "先頭が数式の始まりになる %j は ' を前置する",
    (cellText) => {
      expect(csvCell(cellText).replace(/^"/, "").startsWith("'")).toBe(true)
    }
  )

  it("先頭が \\r の文字列は ' を前置したうえで引用する", () => {
    expect(csvCell("\rname")).toBe(`"'\rname"`)
  })

  it("前置したうえで引用が要るものは両方を行う", () => {
    expect(csvCell('=a,"b"')).toBe(`"'=a,""b"""`)
  })
})

describe("csvCell: 数値はそのまま", () => {
  it.each([
    [-3, "-3"],
    [0, "0"],
    [1.5, "1.5"],
  ])("数値 %j は %j", (cellNumber, expected) => {
    expect(csvCell(cellNumber)).toBe(expected)
  })

  it.each(["-3", "+2", "12", "-0.5"])(
    "数値として読める文字列 %j は前置しない",
    (cellText) => {
      expect(csvCell(cellText)).toBe(cellText)
    }
  )
})

describe("csvCell: 引用", () => {
  it("普通の文字列はそのまま", () => {
    expect(csvCell("山田 太郎")).toBe("山田 太郎")
  })

  it("カンマ・引用符・改行を含むものは引用する", () => {
    expect(csvCell("a,b")).toBe(`"a,b"`)
    expect(csvCell('a"b')).toBe(`"a""b"`)
    expect(csvCell("a\nb")).toBe(`"a\nb"`)
    expect(csvCell("a\rb")).toBe(`"a\rb"`)
  })
})
