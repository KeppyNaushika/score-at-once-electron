import { useMemo } from "react"

import type { StudentExamResult } from "@/electron-src/lib/prisma/student"

import {
  collectSubtotalOptions,
  collectTrendTags,
  groupSubtotalOptions,
} from "./scoreTrendOptions"

/** 系列の編集で選べるタグ・小計（グループ別も）を、表示する試験結果から集める */
export function useTrendFilterOptions(examResults: StudentExamResult[]) {
  const allTags = useMemo(() => collectTrendTags(examResults), [examResults])
  const subtotalOptions = useMemo(
    () => collectSubtotalOptions(examResults),
    [examResults]
  )
  const subtotalGroups = useMemo(
    () => groupSubtotalOptions(subtotalOptions),
    [subtotalOptions]
  )
  return { allTags, subtotalOptions, subtotalGroups }
}
