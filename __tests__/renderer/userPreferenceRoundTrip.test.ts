/**
 * ユーザー設定（KV）の往復。
 *
 * 書き込みは `serializePreference` が保存文字列へ直し、読み出しは
 * `parsePreference` が戻す。**段が1つでもずれると、保存はできているのに
 * 読めない**という形で静かに壊れる（実際に採点状態色が常に既定へ落ちていた）。
 * 型では止まらない（どちらの段でも型は `string`）。
 *
 * 組が繰り返す設定（採点状態の色・クリック回数の動作・側面パネルの節）は
 * **1キーの JSON ではなく行**で持つ。行から画面の形へ畳むところも、ここで見る。
 */
import type { UserScoringStatusColor } from "@prisma/client"
import { describe, expect, it } from "vitest"

import {
  DEFAULT_SCORING_STATUS_COLORS,
  SCORING_COLOR_PRESETS,
  SCORING_STATUS_ORDER,
  toScoringStatusColors,
  toStatusColorValues,
} from "@/lib/scoringStatusColors"
import { parsePreference, serializePreference } from "@/lib/userPreferences"

/** 画面が書いた値が DB に入り、次に読むまでの一往復 */
const roundTrip = <TKey extends Parameters<typeof serializePreference>[0]>(
  key: TKey,
  value: Parameters<typeof serializePreference<TKey>>[1]
) => serializePreference(key, value)

/** 保存された色の行を組む（id と日時は読む側が見ない） */
function colorRow(
  status: string,
  colors: { bg: string; text: string; icon: string }
): UserScoringStatusColor {
  return {
    id: `row-${status}`,
    userId: "user-1",
    status,
    backgroundColor: colors.bg,
    textColor: colors.text,
    iconColor: colors.icon,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

describe("採点状態色（状態ごとに1行）", () => {
  it("保存された行の色で読める", () => {
    const vivid = SCORING_COLOR_PRESETS.find((preset) => preset.id === "vivid")
    if (!vivid) throw new Error("プリセット vivid が無い")

    const rows = SCORING_STATUS_ORDER.map((status) =>
      colorRow(status, vivid.colors[status])
    )

    expect(toScoringStatusColors(rows)).toEqual(vivid.colors)
  })

  it("行が1つも無ければ既定の配色になる", () => {
    expect(toScoringStatusColors([])).toEqual(DEFAULT_SCORING_STATUS_COLORS)
  })

  it("行の無い状態は既定のまま残す（後から状態が増えても落ちない）", () => {
    const rows = [
      colorRow("unscored", { bg: "#111111", text: "#222222", icon: "#333333" }),
    ]

    const colors = toScoringStatusColors(rows)

    expect(colors.unscored.bg).toBe("#111111")
    expect(colors.double_mark).toEqual(
      DEFAULT_SCORING_STATUS_COLORS.double_mark
    )
    expect(colors.no_answer).toEqual(DEFAULT_SCORING_STATUS_COLORS.no_answer)
  })

  it("知らない状態の行は読み飛ばす（他の色を塗り替えない）", () => {
    const rows = [
      colorRow("ungraded", { bg: "#111111", text: "#222222", icon: "#333333" }),
    ]

    expect(toScoringStatusColors(rows)).toEqual(DEFAULT_SCORING_STATUS_COLORS)
  })

  it("画面の色は、そのまま列の形へ写る", () => {
    expect(
      toStatusColorValues({ bg: "#000000", text: "#FFFFFF", icon: "#FF0000" })
    ).toEqual({
      backgroundColor: "#000000",
      textColor: "#FFFFFF",
      iconColor: "#FF0000",
    })
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
