/**
 * 学級所属の時期（過去・在籍中・在籍予定）の判定。
 *
 * 日付の単位で比べ、開始日・終了日とも当日を含む。時刻まで比べていた頃は、終了日が今日の
 * 所属が今日のうちに「終了」になり、開始日が未来の所属まで「在籍中」に数えていた。
 *
 * 日付は端末の暦で作る（`new Date(年, 月, 日, 時)`）。端末のタイムゾーンに依らず同じ結果になる。
 */

import { describe, expect, it } from "vitest"

import {
  compareMembershipPhase,
  isCurrentMembership,
  matchesMembershipStatusFilter,
  type MembershipPhase,
  membershipPhase,
} from "@/lib/membership"

/** 基準日: 2026/4/10 の 18 時（その日の遅い時刻にして、当日扱いの食い違いを出す） */
const TODAY = new Date(2026, 3, 10, 18, 0)

const YESTERDAY = new Date(2026, 3, 9, 9, 0)
/** 今日の、基準時刻より早い時刻（日付入力の値は日本では 9 時になる） */
const TODAY_MORNING = new Date(2026, 3, 10, 9, 0)
/** 今日の、基準時刻より遅い時刻 */
const TODAY_NIGHT = new Date(2026, 3, 10, 23, 0)
const TOMORROW = new Date(2026, 3, 11, 9, 0)

describe("membershipPhase", () => {
  const cases: {
    label: string
    startDate: Date
    endDate: Date | null
    expected: MembershipPhase
  }[] = [
    // 開始日が過去
    {
      label: "開始=過去・終了=無し",
      startDate: YESTERDAY,
      endDate: null,
      expected: "current",
    },
    {
      label: "開始=過去・終了=過去",
      startDate: new Date(2025, 3, 1, 9),
      endDate: YESTERDAY,
      expected: "past",
    },
    {
      label: "開始=過去・終了=今日（基準より早い時刻）",
      startDate: YESTERDAY,
      endDate: TODAY_MORNING,
      expected: "current",
    },
    {
      label: "開始=過去・終了=未来",
      startDate: YESTERDAY,
      endDate: TOMORROW,
      expected: "current",
    },
    // 開始日が今日
    {
      label: "開始=今日（基準より遅い時刻）・終了=無し",
      startDate: TODAY_NIGHT,
      endDate: null,
      expected: "current",
    },
    {
      label: "開始=今日・終了=今日",
      startDate: TODAY_MORNING,
      endDate: TODAY_MORNING,
      expected: "current",
    },
    {
      label: "開始=今日・終了=未来",
      startDate: TODAY_MORNING,
      endDate: TOMORROW,
      expected: "current",
    },
    // 開始日が未来
    {
      label: "開始=未来・終了=無し",
      startDate: TOMORROW,
      endDate: null,
      expected: "upcoming",
    },
    {
      label: "開始=未来・終了=未来",
      startDate: TOMORROW,
      endDate: new Date(2027, 2, 31, 9),
      expected: "upcoming",
    },
  ]

  it.each(cases)("$label → $expected", ({ startDate, endDate, expected }) => {
    expect(membershipPhase({ startDate, endDate }, TODAY)).toBe(expected)
  })

  it("終了日を持たない形（endDate 省略）も在籍中として扱う", () => {
    expect(membershipPhase({ startDate: YESTERDAY }, TODAY)).toBe("current")
  })
})

describe("isCurrentMembership", () => {
  it("在籍中だけ真。在籍予定と過去は偽", () => {
    expect(
      isCurrentMembership({ startDate: YESTERDAY, endDate: null }, TODAY)
    ).toBe(true)
    expect(
      isCurrentMembership({ startDate: TOMORROW, endDate: null }, TODAY)
    ).toBe(false)
    expect(
      isCurrentMembership(
        { startDate: new Date(2025, 3, 1), endDate: YESTERDAY },
        TODAY
      )
    ).toBe(false)
  })

  it("終了日が今日なら、今日の遅い時刻でも在籍中（終了日の当日まで在籍する）", () => {
    expect(
      isCurrentMembership(
        { startDate: YESTERDAY, endDate: TODAY_MORNING },
        TODAY
      )
    ).toBe(true)
  })
})

describe("compareMembershipPhase", () => {
  it("在籍中 → 在籍予定 → 過去 の順に並ぶ", () => {
    const phases: MembershipPhase[] = ["past", "upcoming", "current"]
    expect(phases.toSorted(compareMembershipPhase)).toEqual([
      "current",
      "upcoming",
      "past",
    ])
  })
})

describe("matchesMembershipStatusFilter", () => {
  it("在籍予定は「すべて」でだけ出る", () => {
    expect(matchesMembershipStatusFilter("upcoming", "all")).toBe(true)
    expect(matchesMembershipStatusFilter("upcoming", "current")).toBe(false)
    expect(matchesMembershipStatusFilter("upcoming", "ended")).toBe(false)
  })

  it("在籍中は「在籍中」、過去は「終了済み」に出る", () => {
    expect(matchesMembershipStatusFilter("current", "current")).toBe(true)
    expect(matchesMembershipStatusFilter("current", "ended")).toBe(false)
    expect(matchesMembershipStatusFilter("past", "ended")).toBe(true)
    expect(matchesMembershipStatusFilter("past", "current")).toBe(false)
  })
})
