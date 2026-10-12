/**
 * 答案に重ねる採点マークと点数で、類型評価を ○×△ の代わりに類型の記号で出す
 * （docs/vlm-grading-design.md §4-8-5）。
 *
 * ここで固定すること:
 * - 07 個別表示: 方式と合う評価済みは類型の記号と類型の点数。類型が見つからなければどちらも出さない。
 *   方式と合わない採点（点の採点の評価済み・類型評価の正答）は点数も記号も出さない。
 *   点の採点の設問の点数は従来どおり（正答=配点・誤答=0・部分点/保留=部分点）
 * - 09 PDF: 評価済みは画像を持たず記号を印刷し、点数は類型の点数。方式と合わない採点は点数を印刷しない。
 *   他の状態のマーク画像・点数は従来どおり
 * - 09 採点マーク設定: 評価済みは画像のパスを持たない
 */

import { describe, expect, it } from "vitest"

import { cropRegionScoreDisplayOf } from "@/components/exams/07-score-at-once/ScoringIndividual/utils/cropRegionScoreDisplay"
import { getMarkImagePath } from "@/components/exams/09-export/components/scoring-mark-settings/utils/scoringMarkUtils"
import {
  markImageKeyOf,
  scaleLevelLabelOf,
  scoreToDisplayOf,
} from "@/components/exams/09-export/utils/pdfCanvasRenderer/scoringDataPrint"
import type { ScoringDataForPdf } from "@/components/exams/09-export/utils/pdfCanvasRenderer/types"
import type { ScoringMethod } from "@/types/rubric.types"

const levelA = { id: "level-a", label: "A", description: "根拠2つ", score: 12 }
const levelB = { id: "level-b", label: "B", description: "根拠1つ", score: 6 }
const scaleLevels = [levelA, levelB]

const scaleQuestion = { points: 10, scoringMethod: "scale" }
const pointsQuestion = { points: 10, scoringMethod: "points" }

describe("07 個別表示の点数と類型の記号", () => {
  it("方式と合う評価済みは類型の記号と点数（配点を超えてよい）", () => {
    expect(
      cropRegionScoreDisplayOf({
        cropRegion: scaleQuestion,
        status: "evaluated",
        questionScore: { partialScore: null, scaleLevelId: "level-a" },
        scaleLevels,
      })
    ).toEqual({ actualScore: 12, scaleLevelLabel: "A" })
  })

  it("類型が見つからない評価済みは何も出さない", () => {
    expect(
      cropRegionScoreDisplayOf({
        cropRegion: scaleQuestion,
        status: "evaluated",
        questionScore: { partialScore: null, scaleLevelId: "level-gone" },
        scaleLevels,
      })
    ).toEqual({ actualScore: null, scaleLevelLabel: null })
  })

  it("点の採点の設問の評価済みは方式と合わないので何も出さない", () => {
    expect(
      cropRegionScoreDisplayOf({
        cropRegion: pointsQuestion,
        status: "evaluated",
        questionScore: { partialScore: null, scaleLevelId: "level-a" },
        scaleLevels,
      })
    ).toEqual({ actualScore: null, scaleLevelLabel: null })
  })

  it("類型評価の設問の正答は方式と合わないので点数を出さない", () => {
    expect(
      cropRegionScoreDisplayOf({
        cropRegion: scaleQuestion,
        status: "correct",
        questionScore: { partialScore: null, scaleLevelId: null },
        scaleLevels,
      })
    ).toEqual({ actualScore: null, scaleLevelLabel: null })
  })

  it("点の採点の設問は従来どおり", () => {
    const displayOf = (
      status: "correct" | "incorrect" | "partial" | "pending" | "unscored"
    ) =>
      cropRegionScoreDisplayOf({
        cropRegion: pointsQuestion,
        status,
        questionScore: { partialScore: 4, scaleLevelId: null },
        scaleLevels: [],
      }).actualScore
    expect(displayOf("correct")).toBe(10)
    expect(displayOf("incorrect")).toBe(0)
    expect(displayOf("partial")).toBe(4)
    expect(displayOf("pending")).toBe(4)
    expect(displayOf("unscored")).toBeNull()
  })
})

const scoringDataOf = ({
  status,
  scoringMethod,
  scaleLevel = null,
  partialScore = null,
}: {
  status: string
  scoringMethod: ScoringMethod
  scaleLevel?: { label: string; score: number } | null
  partialScore?: number | null
}): ScoringDataForPdf => ({
  status,
  partialScore,
  scaleLevel,
  cropRegion: {
    id: "region-1",
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.1,
    label: "1",
    maxScore: 10,
    pageNumber: 1,
    scoringMethod,
  },
})

describe("09 PDF の採点マークと点数", () => {
  it("評価済みは画像を持たず、類型の記号を印刷し、点数は類型の点数", () => {
    const scoringData = scoringDataOf({
      status: "evaluated",
      scoringMethod: "scale",
      scaleLevel: { label: "B", score: 6 },
    })
    expect(markImageKeyOf(scoringData)).toBeNull()
    expect(scaleLevelLabelOf(scoringData)).toBe("B")
    expect(scoreToDisplayOf(scoringData)).toBe(6)
  })

  it("類型が無い評価済みは記号も点数も印刷しない", () => {
    const scoringData = scoringDataOf({
      status: "evaluated",
      scoringMethod: "scale",
    })
    expect(scaleLevelLabelOf(scoringData)).toBeNull()
    expect(scoreToDisplayOf(scoringData)).toBeNull()
  })

  it("方式と合わない採点は点数を印刷しない", () => {
    expect(
      scoreToDisplayOf(
        scoringDataOf({ status: "correct", scoringMethod: "scale" })
      )
    ).toBeNull()
    expect(
      scoreToDisplayOf(
        scoringDataOf({ status: "evaluated", scoringMethod: "points" })
      )
    ).toBeNull()
  })

  it("点の採点の設問は従来どおり", () => {
    const pointsScoringDataOf = (status: string) =>
      scoringDataOf({ status, scoringMethod: "points", partialScore: 4 })
    expect(markImageKeyOf(pointsScoringDataOf("correct"))).toBe("correct")
    expect(markImageKeyOf(pointsScoringDataOf("no_answer"))).toBe("incorrect")
    expect(markImageKeyOf(pointsScoringDataOf("double_mark"))).toBe("incorrect")
    expect(scaleLevelLabelOf(pointsScoringDataOf("correct"))).toBeNull()
    expect(scoreToDisplayOf(pointsScoringDataOf("correct"))).toBe(10)
    expect(scoreToDisplayOf(pointsScoringDataOf("partial"))).toBe(4)
    expect(scoreToDisplayOf(pointsScoringDataOf("incorrect"))).toBe(0)
    expect(scoreToDisplayOf(pointsScoringDataOf("no_answer"))).toBe(0)
    expect(scoreToDisplayOf(pointsScoringDataOf("pending"))).toBeNull()
    expect(scoreToDisplayOf(pointsScoringDataOf("unscored"))).toBeNull()
  })
})

describe("09 採点マーク設定の見本", () => {
  it("評価済みは画像のパスを持たない（記号の文字を見本にする）", () => {
    expect(getMarkImagePath("evaluated")).toBeNull()
    expect(getMarkImagePath("correct")).toBe("/score-assets/correct.png")
  })
})
