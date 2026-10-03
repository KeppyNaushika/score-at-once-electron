"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { gradeResultsQuery } from "@/queries/grade"
import {
  type GradeComparisonRow,
  gradeComparisonsQuery,
} from "@/queries/gradeStructure"
import type { GradeCalculationResult } from "@/types/grade.types"

import { buildComparisonMarks } from "../buildComparisonMarks"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_COMPARISONS: GradeComparisonRow[] = []

/**
 * 取れた比較先の結果だけを集める。結果は自分の gradeId を持つので、問い合わせの
 * 並び（添字）と比較先の id を突き合わせずに済む。参照が変わらないよう外に置く
 * （`combine` は関数が同じなら結果を使い回す）
 */
const collectComparedResults = (
  queries: { data?: GradeCalculationResult }[]
): GradeCalculationResult[] =>
  queries.flatMap((query) => (query.data ? [query.data] : []))

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
  const comparedResults = useQueries({
    queries: comparedGradeIds.map((comparedGradeId) =>
      gradeResultsQuery(comparedGradeId)
    ),
    combine: collectComparedResults,
  })

  const comparisonMarks = useMemo(() => {
    if (!result || comparisons.length === 0) return null
    const resultsByGradeId = new Map<string, GradeCalculationResult>([
      [gradeId, result],
      ...comparedResults.map(
        (comparedResult): [string, GradeCalculationResult] => [
          comparedResult.gradeId,
          comparedResult,
        ]
      ),
    ])
    return buildComparisonMarks(result, comparisons, resultsByGradeId)
  }, [result, comparisons, comparedResults, gradeId])

  return { comparisonMarks }
}
