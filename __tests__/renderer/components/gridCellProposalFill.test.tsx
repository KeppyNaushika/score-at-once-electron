// @vitest-environment jsdom
/**
 * 一覧表示のマスの、未確定の提案の塗り（AI採点モード）。
 *
 * ここで固定すること:
 * - 自分が未採点のマスに提案があれば、提案の状態の色の斜線で塗る（斜線 = 未確定）
 * - 自分が採点したマスは、確定の塗りつぶしのまま（提案があっても斜線にしない）
 * - 提案を渡さなければ（一覧表示・採点確定）、これまでどおり斜線は無い
 */

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { GridCell } from "@/components/exams/07-score-at-once/ScoringGrid/GridCell"
import type { ScoringData } from "@/components/exams/07-score-at-once/types"
import { DEFAULT_SCORING_STATUS_COLORS } from "@/lib/scoringStatusColors"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import type { ScoringStatus } from "@/types/scoringStatus.types"

const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z")

const cropRegion: QuestionAnswerRegionRow = {
  id: "crop-region-1",
  examPageId: "exam-page-1",
  label: "1-(1)",
  type: "QUESTION_ANSWER",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.2,
  points: 4,
  orderIndex: 0,
  scoringMethod: "points",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  examPage: {
    id: "exam-page-1",
    examId: "exam-1",
    pageNumber: 1,
    imagePath: "master/page1.png",
    pageSize: "A4",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
  },
  cropSubtotals: [],
}

function answerWithStatus(status: ScoringStatus): ScoringData {
  return {
    id: "answer-1",
    examStudentId: "exam-student-1",
    studentName: "生徒 一",
    imageUrl: "appimg:///answers/1.png",
    maxScore: 4,
    status,
    questionRegion: cropRegion,
    customOrder: 0,
  }
}

function renderCell(
  status: ScoringStatus,
  proposalStatus: ScoringStatus | null | undefined
) {
  const { container } = render(
    <GridCell
      answer={answerWithStatus(status)}
      isSelected={false}
      showStudentNames
      layoutDirection="right-down"
      calculatedCellHeight={0}
      selectionBorderColor="#2563eb"
      scoringColors={DEFAULT_SCORING_STATUS_COLORS}
      onMouseDown={() => {}}
      proposalStatus={proposalStatus}
    />
  )
  const cell = container.querySelector<HTMLElement>("[data-answer-id]")
  if (!cell) throw new Error("マスが描かれていません")
  return cell
}

describe("GridCell の未確定の提案の塗り", () => {
  it("未採点のマスに提案があれば、斜線で塗る", () => {
    const cell = renderCell("unscored", "partial")
    expect(cell.style.backgroundImage).toContain("repeating-linear-gradient")
  })

  it("自分が採点したマスは、提案があっても確定の塗りのまま", () => {
    const cell = renderCell("correct", "partial")
    expect(cell.style.backgroundImage).toBe("")
  })

  it("提案を渡さなければ斜線は無い（一覧表示・採点確定）", () => {
    expect(renderCell("unscored", undefined).style.backgroundImage).toBe("")
    expect(renderCell("unscored", null).style.backgroundImage).toBe("")
  })
})
