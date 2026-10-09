"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  gradeExportComparisonsQuery,
  setGradeExportComparisonMutation,
} from "@/queries/grade"
import {
  type GradeComparisonRow,
  gradeComparisonsQuery,
} from "@/queries/gradeStructure"
import type { GradeCalculationResult } from "@/types/grade.types"
import { DEFAULT_EXPORT_COMPARISON_ENABLED } from "@/types/gradeExport.types"

import { useComparisonMarks } from "../../comparison-marks/useComparisonMarks"
import { buildExcelComparisonColumns } from "../buildExcelComparisonColumns"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_COMPARISONS: GradeComparisonRow[] = []

/** 比較を出力に載せるか（行が無ければ既定） */
function isExportedIn(
  enabledByComparisonId: ReadonlyMap<string, boolean>,
  comparisonId: string
): boolean {
  return (
    enabledByComparisonId.get(comparisonId) ?? DEFAULT_EXPORT_COMPARISON_ENABLED
  )
}

/**
 * 出力（Excel・個人成績通知書）に載せる比較。
 *
 * 選択は成績算出ごとに DB にあり（`GradeExportComparison`）、行が無い比較は既定で出す。
 * Excel の列と通知書の記号は、ここで選ばれた同じ比較から組み立てる。
 */
export function useExportComparisons(
  gradeId: string,
  result: GradeCalculationResult | null
) {
  const { data: comparisons = EMPTY_COMPARISONS } = useQuery(
    gradeComparisonsQuery(gradeId)
  )
  const { data: exportSelections } = useQuery(
    gradeExportComparisonsQuery(gradeId)
  )
  const { mutate: setExportComparison } = useMutation(
    setGradeExportComparisonMutation(gradeId)
  )

  const enabledByComparisonId = useMemo(
    () =>
      new Map(
        (exportSelections ?? []).map((exportSelection) => [
          exportSelection.gradeComparisonId,
          exportSelection.enabled,
        ])
      ),
    [exportSelections]
  )
  const isComparisonExported = (comparisonId: string) =>
    isExportedIn(enabledByComparisonId, comparisonId)

  // 選択がまだ取れていないうちは何も載せない（既定で出した後に外れて見えるのを避ける）
  const exportedComparisons = useMemo(
    () =>
      exportSelections === undefined
        ? EMPTY_COMPARISONS
        : comparisons.filter((comparison) =>
            isExportedIn(enabledByComparisonId, comparison.id)
          ),
    [comparisons, exportSelections, enabledByComparisonId]
  )

  const { comparisonMarks, isComparedResultsPending } = useComparisonMarks(
    gradeId,
    result,
    exportedComparisons
  )

  const excelComparisonColumns = useMemo(
    () =>
      result
        ? buildExcelComparisonColumns(
            result,
            exportedComparisons,
            comparisonMarks
          )
        : [],
    [result, exportedComparisons, comparisonMarks]
  )

  return {
    comparisons,
    isComparisonExported,
    setComparisonExported: (gradeComparisonId: string, enabled: boolean) =>
      setExportComparison({ gradeComparisonId, enabled }),
    comparisonMarks,
    excelComparisonColumns,
    /** 選択か比較先の結果をまだ読み込み中（書き出すと記号が「・」になる） */
    isPending: exportSelections === undefined || isComparedResultsPending,
  }
}
