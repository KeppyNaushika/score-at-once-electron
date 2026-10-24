/**
 * 点数入力の表の数値の読み方の検査。
 *
 * 長音「ー」は文字評価ではカタカナの一部なので `toHalfWidth` では寄せないが、
 * 数値の前に打たれた「ー」はマイナスのつもり。数値として読むときだけ「-」にする。
 */

import { describe, expect, it } from "vitest"

import {
  adjColId,
  diffScoreTableRows,
  isBlankOrFiniteNumber,
  type ScoreRow,
} from "@/components/coursework/04-scores/scoreTableRows"
import type { CourseworkItemWithLetterScales } from "@/types/coursework.types"

const AT = new Date("2026-08-01T00:00:00.000Z")

const scoreItem: CourseworkItemWithLetterScales = {
  id: "item-1",
  courseworkId: "coursework-1",
  name: "小テスト",
  order: 0,
  maxScore: 10,
  inputMode: "numeric",
  createdAt: AT,
  updatedAt: AT,
  letterScales: [],
}

function scoreRow(score: string, adjustment: string): ScoreRow {
  return {
    _courseworkStudentId: "student-1",
    attendanceNumber: "1",
    className: "2年A組",
    studentName: "山田 太郎",
    [scoreItem.id]: score,
    [adjColId(scoreItem.id)]: adjustment,
  }
}

describe("数値として読む", () => {
  it("長音「ー」・全角マイナスを前に打った数はマイナスとして読める", () => {
    expect(isBlankOrFiniteNumber("ー５")).toBe(true)
    expect(isBlankOrFiniteNumber("－５")).toBe(true)
    expect(isBlankOrFiniteNumber("ゴール")).toBe(false)
  })

  it("長音「ー」を前に打った点数・加減点はマイナスとして保存する", () => {
    const changes = diffScoreTableRows(
      [scoreRow("", "")],
      [scoreRow("ー１", "ー２")],
      [scoreItem]
    )
    expect(changes.map((change) => change.patch)).toEqual([
      { score: -1 },
      { adjustment: -2 },
    ])
  })
})
