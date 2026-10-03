import { describe, expect, it, vi } from "vitest"

import { ignoreDeselect } from "@/lib/toggleSelection"

const PLACEMENTS = ["page-first", "student-first"] as const

describe("ignoreDeselect（単一選択の ToggleGroup で選択を外させない）", () => {
  it("選択肢の値はそのまま渡す", () => {
    const onSelect = vi.fn()
    ignoreDeselect(PLACEMENTS, onSelect)("student-first")
    expect(onSelect).toHaveBeenCalledWith("student-first")
  })

  it("選択中をもう一度押したときの空文字は捨てる", () => {
    const onSelect = vi.fn()
    ignoreDeselect(PLACEMENTS, onSelect)("")
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("選択肢に無い値も捨てる", () => {
    const onSelect = vi.fn()
    ignoreDeselect(PLACEMENTS, onSelect)("unknown")
    expect(onSelect).not.toHaveBeenCalled()
  })
})
