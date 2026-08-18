/**
 * ユーザー設定（KV）の往復。
 *
 * 書き込みは `serializePreference` が保存文字列へ直し、読み出しは
 * `parsePreference` が戻す。**段が1つでもずれると、保存はできているのに
 * 読めない**という形で静かに壊れる（実際に採点状態色が常に既定へ落ちていた）。
 * 型では止まらない（どちらの段でも型は `string`）。
 *
 * 中身が JSON の設定（色・クリック採点）は剥がす段が2つある。ここでは
 * 「書いたものが読める」だけを見る。
 */
import { describe, expect, it } from "vitest"

import {
  DEFAULT_SCORING_STATUS_COLORS,
  parseScoringStatusColors,
  SCORING_COLOR_PRESETS,
} from "@/lib/scoringStatusColors"
import { parsePreference, serializePreference } from "@/lib/userPreferences"

/** 画面が書いた値が DB に入り、次に読むまでの一往復 */
const roundTrip = <TKey extends Parameters<typeof serializePreference>[0]>(
  key: TKey,
  value: Parameters<typeof serializePreference<TKey>>[1]
) => serializePreference(key, value)

describe("採点状態色の往復", () => {
  it("プリセットを保存すると、その配色が読める", () => {
    const vivid = SCORING_COLOR_PRESETS.find((preset) => preset.id === "vivid")
    if (!vivid) throw new Error("プリセット vivid が無い")

    const stored = roundTrip(
      "scoringStatusColors",
      JSON.stringify(vivid.colors)
    )

    expect(parseScoringStatusColors(stored)).toEqual(vivid.colors)
  })

  it("1色だけ変えた配色も、そのまま読める", () => {
    const edited = {
      ...DEFAULT_SCORING_STATUS_COLORS,
      correct: { bg: "#000000", text: "#FFFFFF", icon: "#FF0000" },
    }

    const stored = roundTrip("scoringStatusColors", JSON.stringify(edited))

    expect(parseScoringStatusColors(stored).correct.bg).toBe("#000000")
  })

  it("未保存なら既定の配色になる", () => {
    expect(parseScoringStatusColors(null)).toEqual(
      DEFAULT_SCORING_STATUS_COLORS
    )
    expect(parseScoringStatusColors("null")).toEqual(
      DEFAULT_SCORING_STATUS_COLORS
    )
  })

  it("移行前に保存された値（くるまれていない）も読める", () => {
    const legacy = JSON.stringify(DEFAULT_SCORING_STATUS_COLORS)

    expect(parseScoringStatusColors(legacy)).toEqual(
      DEFAULT_SCORING_STATUS_COLORS
    )
  })

  it("旧いキー ungraded は unscored として読む", () => {
    const legacy = JSON.stringify({
      ungraded: { bg: "#111111", text: "#222222", icon: "#333333" },
    })

    expect(parseScoringStatusColors(legacy).unscored.bg).toBe("#111111")
  })
})

describe("カラープリセットidの往復", () => {
  it("選んだ id がそのまま読める（選択の表示が一致する）", () => {
    const stored = roundTrip("scoringColorPresetId", "vivid")

    expect(parsePreference("scoringColorPresetId", stored)).toBe("vivid")
  })

  it("個別に色を変えたときは null になる", () => {
    const stored = roundTrip("scoringColorPresetId", null)

    expect(parsePreference("scoringColorPresetId", stored)).toBeNull()
  })
})

describe("目隠しの設定の往復", () => {
  it("有無と分数がそのまま読める", () => {
    expect(
      parsePreference(
        "screenBlackoutEnabled",
        roundTrip("screenBlackoutEnabled", true)
      )
    ).toBe(true)
    expect(
      parsePreference(
        "screenBlackoutTimeoutMinutes",
        roundTrip("screenBlackoutTimeoutMinutes", 15)
      )
    ).toBe(15)
    expect(
      parsePreference(
        "screenBlackoutAutoFullScreen",
        roundTrip("screenBlackoutAutoFullScreen", true)
      )
    ).toBe(true)
  })

  it("未保存なら既定（無効・5分・全画面にしない）", () => {
    expect(parsePreference("screenBlackoutEnabled", null)).toBe(false)
    expect(parsePreference("screenBlackoutTimeoutMinutes", null)).toBe(5)
    expect(parsePreference("screenBlackoutAutoFullScreen", null)).toBe(false)
  })
})
