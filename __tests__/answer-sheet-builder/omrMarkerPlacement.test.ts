import { describe, expect, it } from "vitest"

import { DEFAULT_SETTINGS } from "@/components/answer-sheet-builder/constants"
import { getPaperDimensions } from "@/components/answer-sheet-builder/hooks/layout/layoutUtils"
import { checkOMRMarkerPlacement } from "@/components/answer-sheet-builder/hooks/layout/omrMarkers"
import type { GlobalSettings } from "@/types/answerSheetDefinition.types"

/** 既定の設定の一部だけを変えた設定 */
function settingsWith(overrides: Partial<GlobalSettings>): GlobalSettings {
  return { ...DEFAULT_SETTINGS, ...overrides }
}

function warningsOf(settings: GlobalSettings): string[] {
  return checkOMRMarkerPlacement(settings, getPaperDimensions(settings))
}

describe("checkOMRMarkerPlacement（#1445）", () => {
  it("既定の解答用紙は警告しない（全用紙・縦横）", () => {
    for (const paperSize of ["A4", "B5", "B4", "A3"] as const) {
      for (const orientation of ["portrait", "landscape"] as const) {
        expect(warningsOf(settingsWith({ paperSize, orientation }))).toEqual([])
      }
    }
  })

  it("マーカーを無効にしていれば検査しない", () => {
    expect(
      warningsOf(
        settingsWith({
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          omrMarkers: { enabled: false, sizeMm: 5, offsetMm: 0 },
        })
      )
    ).toEqual([])
  })

  it("上下の余白を 11mm 以下にすると、マーカーと記入欄が近すぎると警告する", () => {
    // マーカーは端から 6〜11mm。左右の余白 10mm も記入欄に重なるので、上下で離すしかない
    const warnings = warningsOf(
      settingsWith({ margins: { top: 12, bottom: 15, left: 10, right: 10 } })
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/マーカーと記入欄の間が 1mm しかありません/)
  })

  it("マーカーが記入欄に重なれば、重なりの大きさを警告する", () => {
    const warnings = warningsOf(
      settingsWith({ margins: { top: 8, bottom: 8, left: 8, right: 8 } })
    )
    expect(warnings[0]).toMatch(/記入欄に 3mm 重なっています/)
  })

  it("上下か左右のどちらかで離れていれば警告しない", () => {
    expect(
      warningsOf(
        settingsWith({ margins: { top: 5, bottom: 5, left: 13, right: 13 } })
      )
    ).toEqual([])
  })

  it("マーカーを大きくしても、端からの距離を広げても、記入欄に近づけば警告する", () => {
    expect(
      warningsOf(
        settingsWith({ omrMarkers: { enabled: true, sizeMm: 9, offsetMm: 6 } })
      )
    ).toHaveLength(1)
    expect(
      warningsOf(
        settingsWith({ omrMarkers: { enabled: true, sizeMm: 5, offsetMm: 10 } })
      )
    ).toHaveLength(1)
  })

  it("用紙の端に近すぎると警告する", () => {
    const warnings = warningsOf(
      settingsWith({ omrMarkers: { enabled: true, sizeMm: 5, offsetMm: 2 } })
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/用紙の端に近すぎます（2mm）/)
  })

  it("隅の探索範囲（高さ 8%）からはみ出すと警告する", () => {
    // B5 横は高さ 182mm で、探索範囲は端から 14.56mm（紙のずれ 2mm を引いて 12.56mm）
    const warnings = warningsOf(
      settingsWith({
        paperSize: "B5",
        orientation: "landscape",
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        omrMarkers: { enabled: true, sizeMm: 8, offsetMm: 6 },
      })
    )
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(
      /探索範囲（端から 12\.6mm まで）からはみ出します/
    )
  })
})
