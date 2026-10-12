/**
 * 設定の数値欄の文字を範囲内の数にする（空や途中は書かない）
 */
import { describe, expect, it } from "vitest"

import { parseClampedNumber } from "@/lib/clampedNumber"

describe("parseClampedNumber", () => {
  it("空・数にできない途中は null（下限として書き込まない）", () => {
    expect(parseClampedNumber("", { min: 1 })).toBeNull()
    expect(parseClampedNumber("  ", { min: 1 })).toBeNull()
    expect(parseClampedNumber("-", { min: 1 })).toBeNull()
    expect(parseClampedNumber("e", { min: 1, max: 5 })).toBeNull()
  })

  it("範囲に丸める", () => {
    expect(parseClampedNumber("0", { min: 1, max: 5 })).toBe(1)
    expect(parseClampedNumber("8", { min: 1, max: 5 })).toBe(5)
    expect(parseClampedNumber("12.5", { min: 1 })).toBe(12.5)
  })

  it("integer では整数に丸めてから範囲に収める", () => {
    expect(parseClampedNumber("2.4", { min: 1, max: 5, integer: true })).toBe(2)
    expect(parseClampedNumber("5.6", { min: 1, max: 5, integer: true })).toBe(5)
  })
})
