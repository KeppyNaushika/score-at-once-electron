/**
 * 07 の類型評価の設問で、類型をどう見せ、どの類型を選ぶか（docs/vlm-grading-design.md §4-8-5・§4-8-6）。
 *
 * ここで固定すること:
 * - 類型の色は並び順で引き、色の数を超えたら頭に戻る
 * - 設問の組の類型を引く（組が無い・見つからなければ空）
 * - 数字キー 1〜9 が並び順に類型を選ぶ（0・小数点・類型の数を超える数字は何も選ばない）
 * - マスの見せ方: 類型を付けたマスは類型の記号・点数・色、類型が消えた評価済みは既定、
 *   方式と合わない採点（類型評価の正答・誤答・部分点、点の採点の評価済み）は印を付ける
 * - 採点の口に渡された状態を、新旧どちらの呼び方からも読む
 */

import { describe, expect, it } from "vitest"

import {
  findScaleLevels,
  SCALE_LEVEL_PALETTE,
  scaleCellAppearanceOf,
  scaleLevelColorsAt,
  scaleLevelOfDigit,
  scoringStatusOfCall,
} from "@/components/exams/07-score-at-once/ScaleLevel/utils/scaleLevelAppearance"
import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"

const levelA = { id: "level-a", label: "A", description: "根拠2つ", score: 10 }
const levelB = { id: "level-b", label: "B", description: "根拠1つ", score: 6 }
const levelC = { id: "level-c", label: "C", description: "根拠なし", score: 3 }
const scaleLevels = [levelA, levelB, levelC]

describe("類型の色", () => {
  it("並び順で引き、色の数を超えたら頭に戻る", () => {
    expect(scaleLevelColorsAt(0)).toEqual(SCALE_LEVEL_PALETTE[0])
    expect(scaleLevelColorsAt(1)).toEqual(SCALE_LEVEL_PALETTE[1])
    expect(scaleLevelColorsAt(SCALE_LEVEL_PALETTE.length)).toEqual(
      SCALE_LEVEL_PALETTE[0]
    )
    expect(scaleLevelColorsAt(SCALE_LEVEL_PALETTE.length + 2)).toEqual(
      SCALE_LEVEL_PALETTE[2]
    )
  })

  it("隣り合う類型は違う色になる", () => {
    const backgrounds = SCALE_LEVEL_PALETTE.map((colors) => colors.bg)
    expect(new Set(backgrounds).size).toBe(backgrounds.length)
  })
})

describe("設問の組の類型", () => {
  const scoreScales = [
    { id: "scale-1", levels: scaleLevels },
    { id: "scale-2", levels: [levelC] },
  ]

  it("組の類型を並び順のまま返す", () => {
    expect(findScaleLevels(scoreScales, "scale-1")).toEqual(scaleLevels)
  })

  it("組が選ばれていない・見つからなければ空", () => {
    expect(findScaleLevels(scoreScales, null)).toEqual([])
    expect(findScaleLevels(scoreScales, "scale-deleted")).toEqual([])
  })
})

describe("数字キーが選ぶ類型", () => {
  it("1 が先頭、2 が2番目", () => {
    expect(scaleLevelOfDigit(scaleLevels, "1")).toBe(levelA)
    expect(scaleLevelOfDigit(scaleLevels, "2")).toBe(levelB)
    expect(scaleLevelOfDigit(scaleLevels, "3")).toBe(levelC)
  })

  it("0・小数点・類型の数を超える数字は何も選ばない", () => {
    expect(scaleLevelOfDigit(scaleLevels, "0")).toBeNull()
    expect(scaleLevelOfDigit(scaleLevels, ".")).toBeNull()
    expect(scaleLevelOfDigit(scaleLevels, "4")).toBeNull()
    expect(scaleLevelOfDigit([], "1")).toBeNull()
  })
})

describe("方式と合う採点か", () => {
  it("類型評価の設問では正答・誤答・部分点が合わない", () => {
    expect(isStatusCompatibleWithScoringMethod("scale", "correct")).toBe(false)
    expect(isStatusCompatibleWithScoringMethod("scale", "incorrect")).toBe(
      false
    )
    expect(isStatusCompatibleWithScoringMethod("scale", "partial")).toBe(false)
    for (const status of [
      "evaluated",
      "unscored",
      "pending",
      "no_answer",
      "double_mark",
    ]) {
      expect(isStatusCompatibleWithScoringMethod("scale", status)).toBe(true)
    }
  })

  it("点の採点の設問では評価済みだけが合わない", () => {
    expect(isStatusCompatibleWithScoringMethod("points", "evaluated")).toBe(
      false
    )
    expect(isStatusCompatibleWithScoringMethod("deduction", "evaluated")).toBe(
      false
    )
    expect(isStatusCompatibleWithScoringMethod("points", "correct")).toBe(true)
    expect(isStatusCompatibleWithScoringMethod("addition", "partial")).toBe(
      true
    )
  })
})

describe("マスの類型の見せ方", () => {
  it("類型を付けたマスは、類型の記号・点数と並び順の色", () => {
    expect(
      scaleCellAppearanceOf({
        scoringMethod: "scale",
        status: "evaluated",
        scaleLevelId: "level-b",
        scaleLevels,
      })
    ).toEqual({
      label: "B",
      score: 6,
      colors: SCALE_LEVEL_PALETTE[1],
    })
  })

  it("類型が消えた評価済みは、評価済みの既定の見せ方に任せる", () => {
    expect(
      scaleCellAppearanceOf({
        scoringMethod: "scale",
        status: "evaluated",
        scaleLevelId: "level-deleted",
        scaleLevels,
      })
    ).toBeNull()
    expect(
      scaleCellAppearanceOf({
        scoringMethod: "scale",
        status: "evaluated",
        scaleLevelId: null,
        scaleLevels,
      })
    ).toBeNull()
  })

  it("方式と合わない採点（類型評価の設問の正答・部分点、点の採点の設問の評価済み）は未採点と同じに、類型の見せ方にしない", () => {
    for (const status of ["correct", "incorrect", "partial"] as const) {
      expect(
        scaleCellAppearanceOf({
          scoringMethod: "scale",
          status,
          scaleLevelId: null,
          scaleLevels,
        })
      ).toBeNull()
    }
    expect(
      scaleCellAppearanceOf({
        scoringMethod: "points",
        status: "evaluated",
        scaleLevelId: "level-a",
        scaleLevels: [],
      })
    ).toBeNull()
  })

  it("保留・無答・未採点、点の採点の正答は採点状態の見せ方のまま", () => {
    for (const status of ["pending", "no_answer", "unscored"] as const) {
      expect(
        scaleCellAppearanceOf({
          scoringMethod: "scale",
          status,
          scaleLevelId: null,
          scaleLevels,
        })
      ).toBeNull()
    }
    expect(
      scaleCellAppearanceOf({
        scoringMethod: "points",
        status: "correct",
        scaleLevelId: null,
        scaleLevels: [],
      })
    ).toBeNull()
  })
})

describe("採点の口に渡された状態", () => {
  it("新しい形（第1引数が状態）と旧い形（第2引数が状態）のどちらも読む", () => {
    expect(scoringStatusOfCall("correct")).toBe("correct")
    expect(scoringStatusOfCall("partial", 2)).toBe("partial")
    expect(scoringStatusOfCall(["answer-1"], "incorrect")).toBe("incorrect")
    expect(scoringStatusOfCall("answer-1", "pending")).toBe("pending")
  })

  it("状態が無ければ null", () => {
    expect(scoringStatusOfCall(["answer-1"])).toBeNull()
    expect(scoringStatusOfCall("answer-1", 3)).toBeNull()
  })
})
