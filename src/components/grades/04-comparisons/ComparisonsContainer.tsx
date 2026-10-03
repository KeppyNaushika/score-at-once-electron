"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import {
  gradeWorkflowSteps,
  nextStepLabel,
  workflowStep,
  workflowStepHref,
} from "@/lib/shared/workflowSteps"
import {
  type GradeComparisonRow,
  gradeComparisonsQuery,
  gradeDetailQuery,
  gradeListQuery,
} from "@/queries/grade"
import type { GradeSummary } from "@/types/grade.types"

import { GradeItemComparisons } from "./GradeItemComparisons"

interface ComparisonsContainerProps {
  gradeId: string
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_COMPARISONS: GradeComparisonRow[] = []
const EMPTY_GRADES: GradeSummary[] = []

/**
 * 比較の設定。
 *
 * この成績算出の評価項目ごとに、結果に並べて見る相手（任意の成績算出の任意の
 * 評価項目）を対応付ける。上下の判定と表示は結果の画面が行う。
 */
export function ComparisonsContainer({ gradeId }: ComparisonsContainerProps) {
  const { data: grade, isPending: loading } = useQuery(
    gradeDetailQuery(gradeId)
  )
  const { data: comparisons = EMPTY_COMPARISONS } = useQuery(
    gradeComparisonsQuery(gradeId)
  )
  const { data: grades = EMPTY_GRADES } = useQuery(gradeListQuery())

  const comparisonsByGradeItemId = useMemo(() => {
    const grouped = new Map<string, GradeComparisonRow[]>()
    comparisons.forEach((comparison) => {
      grouped.set(comparison.gradeItemId, [
        ...(grouped.get(comparison.gradeItemId) ?? []),
        comparison,
      ])
    })
    return grouped
  }, [comparisons])

  // 相手の候補は、この成績算出を先頭に、残りは一覧と同じ並び
  const candidateGrades = useMemo(
    () => [
      ...grades.filter((candidateGrade) => candidateGrade.id === gradeId),
      ...grades.filter((candidateGrade) => candidateGrade.id !== gradeId),
    ],
    [grades, gradeId]
  )

  if (loading || !grade) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">比較の設定</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        評価項目ごとに、結果の表で並べて見る相手を選びます。別の成績算出の項目でも、
        この成績算出の別の項目でも選べます。結果の表では評定の横に、ここに並べた順で
        ↑（上がった）↓（下がった）→（同じ）が並びます。上下はこの成績算出の項目の
        成績境界で判定し、どちらかの評定が境界に無いときは
        *（上下を決められない）、比較先に評定が無いときは ・ になります。
      </p>

      {grade.gradeItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {`評価項目がありません。「${workflowStep(gradeWorkflowSteps, "02-data-sources").label}」の段で追加してください。`}
        </div>
      ) : (
        <div className="space-y-4">
          {grade.gradeItems.map((gradeItem) => (
            <GradeItemComparisons
              key={gradeItem.id}
              gradeId={gradeId}
              gradeItem={gradeItem}
              comparisons={
                comparisonsByGradeItemId.get(gradeItem.id) ?? EMPTY_COMPARISONS
              }
              candidateGrades={candidateGrades}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <Button asChild>
          <Link
            href={workflowStepHref(
              `/grades/${gradeId}`,
              gradeWorkflowSteps,
              "05-results"
            )}
          >
            {nextStepLabel(gradeWorkflowSteps, "05-results")}
          </Link>
        </Button>
      </div>
    </div>
  )
}
