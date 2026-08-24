/**
 * 年度の数え方。
 *
 * 開始日は設定（`AppPreference`）に持つ。**4月1日を決め打ちにしない**のは、
 * 学校によって、また国によって年度の切れ目が違うため。行が無いときは 4/1 で数える。
 */

/** 年度の開始日を持つ設定のキー（`AppPreference.key`） */
export const FISCAL_YEAR_START_KEY = "fiscalYearStart"

/** 年度の開始日（月日だけ。年は数えるときの日付から決まる） */
export interface FiscalYearStart {
  /** 1〜12 */
  month: number
  /** 1〜31 */
  day: number
}

/** 設定が無いときの年度開始日 */
export const DEFAULT_FISCAL_YEAR_START: FiscalYearStart = { month: 4, day: 1 }

/** その月に何日あるか（2月の閏を含む） */
function daysInMonth(month: number): number {
  // 年をまたいで変わるのは2月だけ。開始日として選べるのは「どの年にも在る日」なので、
  // 閏日を選ばせない（2/29 を開始日にすると、平年に年度が始まらない）
  return new Date(2001, month, 0).getDate()
}

/** 開始日として受け付けられる値か */
export function isValidFiscalYearStart(start: FiscalYearStart): boolean {
  if (!Number.isInteger(start.month) || !Number.isInteger(start.day)) {
    return false
  }
  if (start.month < 1 || start.month > 12) return false
  return start.day >= 1 && start.day <= daysInMonth(start.month)
}

/**
 * 保存されている JSON 文字列を読む。**壊れていれば既定として扱う。**
 *
 * 設定が読めないことと、既定を選んだこととを画面で区別しない（どちらも 4/1 で数える）。
 */
export function parseFiscalYearStart(
  storedText: string | null
): FiscalYearStart {
  if (storedText === null) return DEFAULT_FISCAL_YEAR_START
  try {
    const parsed: unknown = JSON.parse(storedText)
    if (parsed === null || typeof parsed !== "object") {
      return DEFAULT_FISCAL_YEAR_START
    }
    if (!("month" in parsed) || !("day" in parsed)) {
      return DEFAULT_FISCAL_YEAR_START
    }
    const month = parsed.month
    const day = parsed.day
    if (typeof month !== "number" || typeof day !== "number") {
      return DEFAULT_FISCAL_YEAR_START
    }
    const start = { month, day }
    return isValidFiscalYearStart(start) ? start : DEFAULT_FISCAL_YEAR_START
  } catch {
    return DEFAULT_FISCAL_YEAR_START
  }
}

export function serializeFiscalYearStart(start: FiscalYearStart): string {
  return JSON.stringify({ month: start.month, day: start.day })
}

/** ローカル日の `YYYY-MM-DD`（`<input type="date">` と絞り込みが使う形） */
function toDayValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`
}

/**
 * その日が属する年度の範囲。
 *
 * 開始日より前なら**前の年**に始まった年度に居る。終わりは次の開始日の前日
 * （`new Date(年, 月-1, 日-1)` は開始日の1日前を指す。日が 1 なら前月末になる）。
 */
export function fiscalYearRange(
  today: Date,
  start: FiscalYearStart
): { from: string; to: string } {
  const startThisYear = new Date(
    today.getFullYear(),
    start.month - 1,
    start.day
  )
  const startedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )
  const startYear =
    startedToday.getTime() >= startThisYear.getTime()
      ? today.getFullYear()
      : today.getFullYear() - 1

  return {
    from: toDayValue(new Date(startYear, start.month - 1, start.day)),
    to: toDayValue(new Date(startYear + 1, start.month - 1, start.day - 1)),
  }
}

/** 「4月1日」のような表示（設定画面と絞り込みの語に使う） */
export function formatFiscalYearStart(start: FiscalYearStart): string {
  return `${start.month}月${start.day}日`
}
