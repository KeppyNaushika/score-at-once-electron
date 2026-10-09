// @vitest-environment jsdom
/**
 * 設問一覧の右上の印の優先順位。
 *
 * 弱い順に 無印 < 緑の丸（採点中） < オレンジの丸（AI の判定が未反映） < 緑のチェック（採点済み）。
 * オレンジは緑の丸より強く、採点済みのチェックには負ける。完了は四捨五入の割合でなく件数で見る。
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import QuestionNavigator from "@/components/exams/07-score-at-once/ScoringSidePanel/QuestionNavigator"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z")
const EXAM_PAGE_ID = "exam-page-1"

function makeCropRegion(id: string, label: string): QuestionAnswerRegionRow {
  return {
    id,
    examPageId: EXAM_PAGE_ID,
    label,
    type: "QUESTION_ANSWER",
    x: 0.1,
    y: 0.1,
    width: 0.5,
    height: 0.2,
    points: 2,
    orderIndex: 0,
    scoringMethod: "points",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    examPage: {
      id: EXAM_PAGE_ID,
      examId: "exam-1",
      pageNumber: 1,
      imagePath: "master/page1.png",
      pageSize: "A4",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
    cropSubtotals: [],
  }
}

function progressOf(gradedAnswers: number, totalAnswers: number) {
  return {
    gradedAnswers,
    totalAnswers,
    percentage: Math.round((gradedAnswers / totalAnswers) * 100),
  }
}

afterEach(cleanup)

/** 設問1つだけを並べ、その設問のボタンを返す */
function renderQuestion(
  progress: ReturnType<typeof progressOf>,
  hasUnreflectedAi: boolean
) {
  const cropRegion = makeCropRegion("crop-region-1", "問1")
  render(
    <QuestionNavigator
      questionRegions={[cropRegion]}
      currentCropRegion={null}
      onCropRegionChange={() => {}}
      onPrevQuestion={() => {}}
      onNextQuestion={() => {}}
      questionProgress={{ [cropRegion.id]: progress }}
      unreflectedAiQuestionIds={
        new Set(hasUnreflectedAi ? [cropRegion.id] : [])
      }
    />
  )
  return screen.getByRole("button", { name: /問1/ })
}

const BADGE_LABELS = ["採点済み", "AI の判定が未反映", "採点中"]

/** ボタンに付いている印のラベル（無ければ空） */
function badgeLabelsOn(questionButton: HTMLElement) {
  return BADGE_LABELS.filter(
    (badgeLabel) =>
      questionButton.querySelector(`[aria-label="${badgeLabel}"]`) !== null
  )
}

describe("設問一覧の印", () => {
  it("未着手で未反映も無ければ印を出さない", () => {
    expect(badgeLabelsOn(renderQuestion(progressOf(0, 10), false))).toEqual([])
  })

  it("採点中は緑の丸", () => {
    expect(badgeLabelsOn(renderQuestion(progressOf(3, 10), false))).toEqual([
      "採点中",
    ])
  })

  it("AI の判定が未反映なら、未着手でも採点中でもオレンジ", () => {
    expect(badgeLabelsOn(renderQuestion(progressOf(0, 10), true))).toEqual([
      "AI の判定が未反映",
    ])
    cleanup()
    expect(badgeLabelsOn(renderQuestion(progressOf(3, 10), true))).toEqual([
      "AI の判定が未反映",
    ])
  })

  it("全部採点し終えたら、未反映があってもチェック", () => {
    expect(badgeLabelsOn(renderQuestion(progressOf(10, 10), true))).toEqual([
      "採点済み",
    ])
  })

  it("四捨五入で 100% でも、残りがあればチェックにしない", () => {
    expect(badgeLabelsOn(renderQuestion(progressOf(199, 200), true))).toEqual([
      "AI の判定が未反映",
    ])
  })
})
