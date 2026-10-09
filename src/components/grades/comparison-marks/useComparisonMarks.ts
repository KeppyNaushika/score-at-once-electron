"use client"

import { useQueries } from "@tanstack/react-query"
import { useMemo } from "react"

import { gradeResultsQuery } from "@/queries/grade"
import type { GradeComparisonRow } from "@/queries/gradeStructure"
import type { GradeCalculationResult } from "@/types/grade.types"

import { buildComparisonMarks } from "./buildComparisonMarks"

/**
 * 取れた比較先の結果だけを集める。結果は自分の gradeId を持つので、問い合わせの
 * 並び（添字）と比較先の id を突き合わせずに済む。まだ取れていない比較先があるかも
 * 返す（出力は、取れるまで待たないと記号が「・」で書き出される）。参照が変わらないよう
 * 外に置く（`combine` は関数が同じなら結果を使い回す）
 */
const collectComparedResults = (
  queries: { data?: GradeCalculationResult; isPending: boolean }[]
) => ({
  comparedResults: queries.flatMap((query) => (query.data ? [query.data] : [])),
  isComparedResultsPending: queries.some((query) => query.isPending),
})

/**
 * 比較の記号（結果の表と、出力）。
 *
 * 比較先の成績算出ごとに結果を算出し直して引く（成績算出どうしは結果を共有して
 * いない）。同じキーなので、その成績算出の結果画面とキャッシュを共有する。
 * 比較が1つも無ければ null（表は今までどおり）。
 *
 * @param comparisons 記号にする比較。結果画面はすべて、出力は出力で使うものだけを渡す
 *   （参照が変わると組み立て直すので、呼び出し側で安定させる）
 */
export function useComparisonMarks(
  gradeId: string,
  result: GradeCalculationResult | null,
  comparisons: readonly GradeComparisonRow[]
) {
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
  const { comparedResults, isComparedResultsPending } = useQueries({
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

  return { comparisonMarks, isComparedResultsPending }
}
