/**
 * AI採点モードの計算（費用の概算・設定ごとの一致率・プロンプトの差分・注釈の用紙の向き）。
 */

import { describe, expect, it } from "vitest"

import {
  inferPaperDimensionsFromInkGrid,
  placeAdoptionAnnotation,
} from "@/components/exams/07-score-at-once/AiGrading/utils/adoptionAnnotation"
import {
  estimateImageTokens,
  estimateRunCost,
} from "@/components/exams/07-score-at-once/AiGrading/utils/costEstimate"
import { diffPromptLines } from "@/components/exams/07-score-at-once/AiGrading/utils/promptDiff"
import { aggregateSettingsAgreement } from "@/components/exams/07-score-at-once/AiGrading/utils/settingsComparison"

import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  makeAttempt,
  makeInk,
  makeQuestionScore,
  makeRun,
} from "./helpers/aiGradingRowFixtures"

describe("費用の概算", () => {
  const baseInput = {
    model: "claude-opus-5-5",
    effort: "medium" as const,
    mode: "realtime" as const,
    // 750画素 × 1000画素 → 1000トークン
    answerImages: [{ width: 750, height: 1000 }],
    fixedImages: [],
    promptCharacterCount: 500,
  }

  it("画像は 幅×高さ÷750 トークン", () => {
    expect(estimateImageTokens({ width: 750, height: 1000 })).toBe(1000)
  })

  it("Opus 5.5 は 入力 $4 / 出力 $20（100万トークンあたり）", () => {
    const estimate = estimateRunCost(baseInput)
    // 入力 = 文字 (500 + 1500) + 画像 1000 = 3000、出力 = 1500
    expect(estimate.inputTokens).toBe(3000)
    expect(estimate.outputTokens).toBe(1500)
    expect(estimate.costUsd).toBeCloseTo((3000 * 4 + 1500 * 20) / 1_000_000)
  })

  it("バッチは半額、単価の分からないモデルは金額を出さない", () => {
    const realtime = estimateRunCost(baseInput).costUsd ?? 0
    expect(
      estimateRunCost({ ...baseInput, mode: "batch" }).costUsd
    ).toBeCloseTo(realtime / 2)
    expect(
      estimateRunCost({ ...baseInput, model: "gpt-unknown" }).costUsd
    ).toBeNull()
  })
})

describe("設定ごとの一致率", () => {
  it("モデル・effort・拡大率でまとめ、採用した試行は数えない", () => {
    const opusRun = makeRun({
      id: "run-opus",
      attempts: [
        makeAttempt({ examStudentId: "s1", inputTokens: 10, outputTokens: 5 }),
        makeAttempt({
          examStudentId: "s2",
          status: "partial",
          partialScore: 3,
        }),
        makeAttempt({ examStudentId: "s3", adoptedAt: new Date() }),
      ],
    })
    const haikuRun = makeRun({
      id: "run-haiku",
      model: "claude-haiku-4-5",
      attempts: [makeAttempt({ examStudentId: "s1", status: "incorrect" })],
    })
    const agreements = aggregateSettingsAgreement({
      runs: [opusRun, haikuRun],
      questionScores: [
        makeQuestionScore({ examStudentId: "s1" }),
        makeQuestionScore({ examStudentId: "s2" }),
        makeQuestionScore({ examStudentId: "s3" }),
      ],
      cropRegionId: CROP_REGION_ID,
      currentUserId: CURRENT_USER_ID,
      points: 4,
    })
    expect(agreements).toHaveLength(2)
    expect(agreements[0]).toMatchObject({
      model: "claude-opus-5-5",
      comparedCount: 2,
      exactMatchCount: 1,
      withinOnePointCount: 2,
      inputTokens: 10,
      outputTokens: 5,
    })
    expect(agreements[1]).toMatchObject({
      model: "claude-haiku-4-5",
      comparedCount: 1,
      exactMatchCount: 0,
      withinOnePointCount: 0,
    })
  })
})

describe("プロンプトの差分", () => {
  it("同じ行・消えた行・足した行を順に並べる", () => {
    expect(
      diffPromptLines("a\nb\nc", "a\nB\nc\nd").map(
        (diffLine) => `${diffLine.kind}:${diffLine.text}`
      )
    ).toEqual(["same:a", "removed:b", "added:B", "same:c", "added:d"])
  })

  it("行の目印は差分の中で重ならない（同じ文面の行が何度あっても）", () => {
    const lineKeys = diffPromptLines("x\nx", "x\nx\nx").map(
      (diffLine) => diffLine.lineKey
    )
    expect(new Set(lineKeys).size).toBe(lineKeys.length)
  })
})

describe("注釈の用紙の向き", () => {
  it("占有グリッドの列数・行数から、縦か横かを決める", () => {
    const portraitGrid = makeInk().inkGrid
    expect(inferPaperDimensionsFromInkGrid("A4", portraitGrid)).toEqual({
      width: 210,
      height: 297,
    })
    const landscapeGrid = {
      ...portraitGrid,
      cellWidth: 1 / 297,
      cellHeight: 1 / 210,
    }
    expect(inferPaperDimensionsFromInkGrid("A4", landscapeGrid)).toEqual({
      width: 297,
      height: 210,
    })
  })

  it("測れなかった答案でも、枠の中に置ける。注釈文が空なら置かない", () => {
    const region = { x: 0.1, y: 0.1, width: 0.5, height: 0.2 }
    const placement = placeAdoptionAnnotation({
      annotationText: "符号の誤り",
      inkGrid: null,
      region,
      pageSize: "A4",
      fontSizeMm: 5,
    })
    expect(placement).not.toBeNull()
    expect(placement?.x).toBeGreaterThanOrEqual(region.x)
    expect(placement?.y).toBeGreaterThanOrEqual(region.y)
    expect(
      placeAdoptionAnnotation({
        annotationText: "  ",
        inkGrid: null,
        region,
        pageSize: "A4",
        fontSizeMm: 5,
      })
    ).toBeNull()
  })
})
