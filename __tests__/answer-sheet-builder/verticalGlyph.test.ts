import { describe, expect, it } from "vitest"

import { verticalGlyphAdjust } from "@/components/answer-sheet-builder/components/preview/verticalGlyph"

describe("verticalGlyphAdjust", () => {
  it("通常の漢字・仮名は補正なし", () => {
    for (const character of "あ亜A1") {
      expect(verticalGlyphAdjust(character)).toEqual({
        rotate: 0,
        dxRatio: 0,
        dyRatio: 0,
      })
    }
  })

  it("カギ括弧・各種括弧は90°回転", () => {
    for (const character of "「」『』（）〔〕【】") {
      expect(verticalGlyphAdjust(character).rotate).toBe(90)
    }
  })

  it("長音符・ダッシュ類は90°回転", () => {
    for (const character of "ー〜…—") {
      expect(verticalGlyphAdjust(character).rotate).toBe(90)
    }
  })

  it("拗促音（小書き仮名）は右上寄せ（回転なし）", () => {
    for (const character of "ゃゅょっぁゥ") {
      const adjustment = verticalGlyphAdjust(character)
      expect(adjustment.rotate).toBe(0)
      expect(adjustment.dxRatio).toBeGreaterThan(0) // 右へ
      expect(adjustment.dyRatio).toBeLessThan(0) // 上へ
    }
  })

  it("句読点は右上寄せ（回転なし）", () => {
    for (const character of "、。") {
      const adjustment = verticalGlyphAdjust(character)
      expect(adjustment.rotate).toBe(0)
      expect(adjustment.dxRatio).toBeGreaterThan(0)
      expect(adjustment.dyRatio).toBeLessThan(0)
    }
  })
})
