"use client"

import { useQuery } from "@tanstack/react-query"

import {
  DEFAULT_FISCAL_YEAR_START,
  FISCAL_YEAR_START_KEY,
  type FiscalYearStart,
  parseFiscalYearStart,
} from "@/lib/fiscalYear"
import { appPreferenceQuery } from "@/queries/settings"

/**
 * 年度の開始日。設定が無い（まだ誰も決めていない）あいだは既定の 4/1。
 *
 * 読むのは絞り込みの「今年度」と設定画面の2か所。どちらも同じキャッシュを見るので、
 * 設定を変えると絞り込みの側もその場で追いつく。
 */
export function useFiscalYearStart(): FiscalYearStart {
  const { data } = useQuery(appPreferenceQuery(FISCAL_YEAR_START_KEY))
  if (data === undefined) return DEFAULT_FISCAL_YEAR_START
  return parseFiscalYearStart(data)
}
