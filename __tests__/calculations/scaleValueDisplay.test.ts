/**
 * 類型評価の値の見せ方のテスト（docs/vlm-grading-design.md §4-8-8）
 *
 * - formatScaleValue: 「8」「A (8)」「A」と、点数が無いときは記号だけ
 * - 個人成績表の設問の欄（questionMark）: 類型評価の設問は記号をマークに、得点欄は見せ方に従い、
 *   正答率は「—」
 */
import { describe, expect, it } from "vitest"

import {
  formatQuestionCorrectRateText,
  formatQuestionScoreText,
  getMarkInfo,
} from "@/components/exams/09-export/components/individual-report/questionMark"
import type { ScoreDetail } from "@/electron-src/lib/shared/types"
import { formatScaleValue } from "@/lib/shared/scaleValueDisplay"

function scoreDetail(overrides: Partial<ScoreDetail>): ScoreDetail {
  return {
    questionId: "question-1",
    questionLabel: "1",
    score: 8,
    maxScore: 10,
    status: "evaluated",
    scoringMethod: "scale",
    scaleLevel: { id: "level-a", label: "A", score: 8 },
    ...overrides,
  }
}

describe("formatScaleValue", () => {
  const value = { label: "A", pointsText: "8" }

  it("points は点数だけ", () => {
    expect(formatScaleValue(value, "points")).toBe("8")
  })

  it("label_points は記号と点数", () => {
    expect(formatScaleValue(value, "label_points")).toBe("A (8)")
  })

  it("label は記号だけ", () => {
    expect(formatScaleValue(value, "label")).toBe("A")
  })

  it("点数が無い（換算が無い）ときは、どの見せ方でも記号だけ", () => {
    const withoutPoints = { label: "B", pointsText: null }
    expect(formatScaleValue(withoutPoints, "points")).toBe("B")
    expect(formatScaleValue(withoutPoints, "label_points")).toBe("B")
    expect(formatScaleValue(withoutPoints, "label")).toBe("B")
  })
})

describe("getMarkInfo", () => {
  it("類型評価の設問は類型の記号をマークにする", () => {
    expect(getMarkInfo(scoreDetail({})).mark).toBe("A")
  })

  it("類型評価の設問で類型が無ければ空欄（無答は「-」）", () => {
    expect(
      getMarkInfo(scoreDetail({ status: "unscored", scaleLevel: null })).mark
    ).toBe("")
    expect(
      getMarkInfo(scoreDetail({ status: "no_answer", scaleLevel: null })).mark
    ).toBe("-")
  })

  it("類型評価の設問に残った正答の採点（方式と合わない）は○にしない", () => {
    expect(
      getMarkInfo(scoreDetail({ status: "correct", scaleLevel: null })).mark
    ).toBe("")
  })

  it("点の採点の設問は今までどおり○×△", () => {
    const pointsQuestion = {
      scoringMethod: "points" as const,
      scaleLevel: null,
    }
    expect(
      getMarkInfo(scoreDetail({ ...pointsQuestion, status: "correct" })).mark
    ).toBe("○")
    expect(
      getMarkInfo(scoreDetail({ ...pointsQuestion, status: "incorrect" })).mark
    ).toBe("×")
    expect(
      getMarkInfo(scoreDetail({ ...pointsQuestion, status: "partial" })).mark
    ).toBe("△")
  })
})

describe("formatQuestionScoreText", () => {
  it("類型評価の設問は見せ方に従う", () => {
    expect(formatQuestionScoreText(scoreDetail({}), "points")).toBe("8")
    expect(formatQuestionScoreText(scoreDetail({}), "label_points")).toBe(
      "A (8)"
    )
    expect(formatQuestionScoreText(scoreDetail({}), "label")).toBe("A")
  })

  it("類型評価の設問で類型が無ければ「-」", () => {
    expect(
      formatQuestionScoreText(
        scoreDetail({ status: "unscored", score: null, scaleLevel: null }),
        "label_points"
      )
    ).toBe("-")
  })

  it("点の採点の設問は得点（無ければ「-」）", () => {
    const pointsQuestion = {
      scoringMethod: "points" as const,
      scaleLevel: null,
    }
    expect(
      formatQuestionScoreText(
        scoreDetail({ ...pointsQuestion, status: "partial", score: 3 }),
        "label"
      )
    ).toBe("3")
    expect(
      formatQuestionScoreText(
        scoreDetail({ ...pointsQuestion, status: "unscored", score: null }),
        "label"
      )
    ).toBe("-")
  })
})

describe("formatQuestionCorrectRateText", () => {
  it("類型評価の設問は「—」", () => {
    expect(
      formatQuestionCorrectRateText(scoreDetail({}), { "question-1": 50 })
    ).toBe("—")
  })

  it("点の採点の設問は四捨五入した百分率", () => {
    expect(
      formatQuestionCorrectRateText(scoreDetail({ scoringMethod: "points" }), {
        "question-1": 66.6,
      })
    ).toBe("67%")
  })
})
