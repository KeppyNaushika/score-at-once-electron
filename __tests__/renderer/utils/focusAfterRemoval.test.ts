import { describe, expect, it } from "vitest"

import { pageIdToFocusAfterRemoval } from "@/components/pdf-tools/export-panel/focusAfterRemoval"

describe("pageIdToFocusAfterRemoval", () => {
  const pageIds = ["a", "b", "c"]

  it("並び順で次のカードへ移す", () => {
    expect(pageIdToFocusAfterRemoval(pageIds, "a")).toBe("b")
    expect(pageIdToFocusAfterRemoval(pageIds, "b")).toBe("c")
  })

  it("最後のカードを除外したら前のカードへ移す", () => {
    expect(pageIdToFocusAfterRemoval(pageIds, "c")).toBe("b")
  })

  it("最後の1枚を除外したら移す先は無い", () => {
    expect(pageIdToFocusAfterRemoval(["a"], "a")).toBeUndefined()
  })

  it("並びに無い id なら移す先は無い", () => {
    expect(pageIdToFocusAfterRemoval(pageIds, "x")).toBeUndefined()
  })
})
