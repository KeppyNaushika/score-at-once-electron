import { describe, expect, it } from "vitest"

import { matchesSearchTerm } from "@/lib/searchText"

const FULL_WIDTH_SPACE = "　"

describe("matchesSearchTerm", () => {
  it("空白（全角・半角・無し）を区別しない", () => {
    const searchTerms = [
      "山田太郎",
      "山田 太郎",
      `山田${FULL_WIDTH_SPACE}太郎`,
      ` 山田  太郎${FULL_WIDTH_SPACE}`,
    ]
    const targets = ["山田太郎", "山田 太郎", `山田${FULL_WIDTH_SPACE}太郎`]
    for (const searchTerm of searchTerms) {
      for (const target of targets) {
        expect(matchesSearchTerm(searchTerm, [target])).toBe(true)
      }
    }
  })

  it("カタカナとひらがな、全角と半角の英数、大文字と小文字を区別しない", () => {
    expect(matchesSearchTerm("やまだ", ["ヤマダ タロウ"])).toBe(true)
    expect(matchesSearchTerm("ａ１２", ["A12"])).toBe(true)
  })

  it("検索語が空か空白だけなら全部を通す", () => {
    expect(matchesSearchTerm("", ["山田"])).toBe(true)
    expect(matchesSearchTerm(` ${FULL_WIDTH_SPACE}`, ["山田"])).toBe(true)
  })

  it("どれにも含まれなければ通さず、null は飛ばす", () => {
    expect(matchesSearchTerm("佐藤", ["山田太郎", null, undefined])).toBe(false)
    expect(matchesSearchTerm("123", [null, "S0123"])).toBe(true)
  })
})
