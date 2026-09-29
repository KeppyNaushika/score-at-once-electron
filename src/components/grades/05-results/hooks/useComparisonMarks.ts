"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import {
  type GradeComparisonRow,
  gradeComparisonsQuery,
  gradeResultsQuery,
} from "@/queries/grade"
import type { GradeCalculationResult } from "@/types/grade.types"

import { buildComparisonMarks } from "../buildComparisonMarks"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_COMPARISONS: GradeComparisonRow[] = []

/**
 * 結果の表に並べる比較の記号。
 *
 * 比較先の成績算出ごとに結果を算出し直して引く（成績算出どうしは結果を共有して
 * いない）。同じキーなので、その成績算出の結果画面とキャッシュを共有する。
 * 比較が1つも無ければ null（表は今までどおり）。
 */
export function useComparisonMarks(
  gradeId: string,
  result: GradeCalculationResult | null
) {
  const { data: comparisons = EMPTY_COMPARISONS } = useQuery(
    gradeComparisonsQuery(gradeId)
  )

  const comparedGradeIds = useMemo(
    () => [
      ...new Set(
        comparisons
          .map((comparison) => comparison.comparedGradeItem.gradeId)
          .filter((comparedGradeId) => comparedGradeId !== gradeId)
      ),
    ],
    [comparisons, gradeId]
  )
  const comparedResultQueries = useQueries({
    queries: comparedGradeIds.map((comparedGradeId) =>
      gradeResultsQuery(comparedGradeId)
    ),
  })

  const comparisonMarks = useMemo(() => {
    if (!result || comparisons.length === 0) return null
    const resultsByGradeId = new Map<string, GradeCalculationResult>([
      [gradeId, result],
    ])
    comparedGradeIds.forEach((comparedGradeId, index) => {
      const comparedResult = comparedResultQueries[index]?.data
      if (comparedResult) resultsByGradeId.set(comparedGradeId, comparedResult)
    })
    return buildComparisonMarks(result, comparisons, resultsByGradeId)
  }, [result, comparisons, comparedGradeIds, comparedResultQueries, gradeId])

  return { comparisonMarks }
}
