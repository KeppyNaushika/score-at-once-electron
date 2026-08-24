"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_FISCAL_YEAR_START,
  FISCAL_YEAR_START_KEY,
  fiscalYearRange,
  type FiscalYearStart,
  formatFiscalYearStart,
  parseFiscalYearStart,
  serializeFiscalYearStart,
} from "@/lib/fiscalYear"
import {
  appPreferenceQuery,
  setAppPreferenceMutation,
} from "@/queries/settings"

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** その月に在る日。2月は28日まで（どの年にも在る日だけを選ばせる） */
function daysOf(month: number): number[] {
  const lastDay = new Date(2001, month, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => i + 1)
}

/**
 * 年度の設定。
 *
 * **利用者ごとではなく、DB を共有する全員で1つ**（`AppPreference`）。人によって
 * 違う値を持つと、同じ「今年度」で絞ったのに見えるものが人ごとに変わる。
 */
export function FiscalYearTab() {
  const { data: storedText } = useQuery(
    appPreferenceQuery(FISCAL_YEAR_START_KEY)
  )
  const { mutate: saveFiscalYearStart } = useMutation(
    setAppPreferenceMutation(FISCAL_YEAR_START_KEY)
  )

  const fiscalYearStart =
    storedText === undefined
      ? DEFAULT_FISCAL_YEAR_START
      : parseFiscalYearStart(storedText)

  // 月を変えた拍子に日が月末を越えることがある（1/31 → 2 月）。越えたぶんは
  // その月の末日へ寄せる
  const change = (next: FiscalYearStart) => {
    const lastDay = daysOf(next.month).length
    saveFiscalYearStart(
      serializeFiscalYearStart({
        month: next.month,
        day: Math.min(next.day, lastDay),
      })
    )
  }

  // 「いま何年度なのか」を見せる。月日だけを選ばせると、それが何月何日から何月何日
  // までを指すのかが分からない
  const [today] = useState(() => new Date())
  const currentRange = fiscalYearRange(today, fiscalYearStart)

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">年度の開始日</h2>
          <p className="text-sm text-muted-foreground">
            一覧の絞り込みで「今年度」がどこからどこまでを指すかを決めます。この設定は
            このデータベースを共有する全員で同じものになります。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Label className="w-36 shrink-0 text-sm">開始日</Label>
          <Select
            value={String(fiscalYearStart.month)}
            onValueChange={(value) =>
              change({ ...fiscalYearStart, month: Number(value) })
            }
          >
            <SelectTrigger className="w-24" aria-label="年度開始の月">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month) => (
                <SelectItem key={month} value={String(month)}>
                  {month}月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(fiscalYearStart.day)}
            onValueChange={(value) =>
              change({ ...fiscalYearStart, day: Number(value) })
            }
          >
            <SelectTrigger className="w-24" aria-label="年度開始の日">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {daysOf(fiscalYearStart.month).map((day) => (
                <SelectItem key={day} value={String(day)}>
                  {day}日
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-sm text-muted-foreground">
          {formatFiscalYearStart(fiscalYearStart)}始まり —— いまの年度は{" "}
          <span className="tabular-nums">{currentRange.from}</span> から{" "}
          <span className="tabular-nums">{currentRange.to}</span> まで
        </p>
      </section>
    </div>
  )
}
