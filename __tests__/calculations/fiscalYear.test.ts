/**
 * 年度の数え方の検査。
 *
 * 4月始まりを決め打ちにしていないことと、**開始日より前の日はひとつ前の年度に居る**
 * ことを固定する。ここを間違えると、3月に「今年度」で絞ったときに、その年度の
 * 答案が1件も出てこない。
 */

import { describe, expect, it } from "vitest"

import {
  DEFAULT_FISCAL_YEAR_START,
  fiscalYearRange,
  type FiscalYearStart,
  formatFiscalYearStart,
  isValidFiscalYearStart,
  parseFiscalYearStart,
  serializeFiscalYearStart,
} from "@/lib/fiscalYear"

const APRIL_FIRST: FiscalYearStart = { month: 4, day: 1 }

describe("年度の範囲", () => {
  it("開始日より後の日は、その年に始まった年度", () => {
    expect(fiscalYearRange(new Date(2026, 7, 24), APRIL_FIRST)).toEqual({
      from: "2026-04-01",
      to: "2027-03-31",
    })
  })

  it("開始日より前の日は、ひとつ前の年に始まった年度", () => {
    expect(fiscalYearRange(new Date(2026, 1, 10), APRIL_FIRST)).toEqual({
      from: "2025-04-01",
      to: "2026-03-31",
    })
  })

  it("開始日ちょうどは、その日から始まる年度に入る", () => {
    expect(fiscalYearRange(new Date(2026, 3, 1), APRIL_FIRST)).toEqual({
      from: "2026-04-01",
      to: "2027-03-31",
    })
    // その前日は前の年度
    expect(fiscalYearRange(new Date(2026, 2, 31), APRIL_FIRST)).toEqual({
      from: "2025-04-01",
      to: "2026-03-31",
    })
  })

  it("1月1日始まりなら暦年と同じになる", () => {
    expect(
      fiscalYearRange(new Date(2026, 7, 24), { month: 1, day: 1 })
    ).toEqual({ from: "2026-01-01", to: "2026-12-31" })
  })

  it("9月1日始まりも数えられる", () => {
    expect(
      fiscalYearRange(new Date(2026, 7, 24), { month: 9, day: 1 })
    ).toEqual({ from: "2025-09-01", to: "2026-08-31" })
  })

  it("月の途中から始まる年度も、終わりは次の開始日の前日", () => {
    expect(
      fiscalYearRange(new Date(2026, 7, 24), { month: 4, day: 15 })
    ).toEqual({ from: "2026-04-15", to: "2027-04-14" })
  })

  it("閏年をまたいでも終わりがずれない", () => {
    // 2028 は閏年。3/1 始まりの年度は 2028-02-29 で終わる
    expect(fiscalYearRange(new Date(2027, 5, 1), { month: 3, day: 1 })).toEqual(
      {
        from: "2027-03-01",
        to: "2028-02-29",
      }
    )
  })
})

describe("設定の読み書き", () => {
  it("行が無ければ 4月1日で数える", () => {
    expect(parseFiscalYearStart(null)).toEqual(DEFAULT_FISCAL_YEAR_START)
  })

  it("書いたものはそのまま読める", () => {
    const start: FiscalYearStart = { month: 9, day: 1 }
    expect(parseFiscalYearStart(serializeFiscalYearStart(start))).toEqual(start)
  })

  it("壊れていれば既定として扱う（読めないことを画面へ持ち込まない）", () => {
    expect(parseFiscalYearStart("{")).toEqual(DEFAULT_FISCAL_YEAR_START)
    expect(parseFiscalYearStart("null")).toEqual(DEFAULT_FISCAL_YEAR_START)
    expect(parseFiscalYearStart('{"month":4}')).toEqual(
      DEFAULT_FISCAL_YEAR_START
    )
    expect(parseFiscalYearStart('{"month":"4","day":"1"}')).toEqual(
      DEFAULT_FISCAL_YEAR_START
    )
  })

  it("在りえない日付は既定として扱う", () => {
    expect(parseFiscalYearStart('{"month":13,"day":1}')).toEqual(
      DEFAULT_FISCAL_YEAR_START
    )
    expect(parseFiscalYearStart('{"month":2,"day":30}')).toEqual(
      DEFAULT_FISCAL_YEAR_START
    )
  })

  it("2月29日は選ばせない（平年に年度が始まらなくなる）", () => {
    expect(isValidFiscalYearStart({ month: 2, day: 29 })).toBe(false)
    expect(isValidFiscalYearStart({ month: 2, day: 28 })).toBe(true)
  })

  it("整数でない値も弾く", () => {
    expect(isValidFiscalYearStart({ month: 4.5, day: 1 })).toBe(false)
  })
})

describe("表示", () => {
  it("月日で言う", () => {
    expect(formatFiscalYearStart({ month: 4, day: 1 })).toBe("4月1日")
  })
})
