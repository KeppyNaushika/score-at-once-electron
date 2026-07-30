"use client"

import { useMemo, useState } from "react"

import { evaluateConstraints } from "@/lib/gradeConstraints"
import type {
  GradeCalculationResult,
  GradeCellTarget,
  GradeConstraintData,
  GradeOverrideInput,
} from "@/types/grade.types"

import { ConstraintLegend } from "./ConstraintLegend"
import { EditableGradeLabel } from "./EditableGradeLabel"
import { FrozenCellControl } from "./FrozenCellControl"
import { GradeItemBreakdownPopover } from "./GradeItemBreakdownPopover"

interface ResultsTableProps {
  result: GradeCalculationResult
  constraints?: GradeConstraintData[]
  onGradeOverride: (params: GradeOverrideInput) => void
  /** 対象セルを現在のライブ値で確定し直す */
  onRefreezeCell: (target: GradeCellTarget) => void
  /** 対象セルの確定を解除する */
  onUnfreezeCell: (target: GradeCellTarget) => void
}

type SortKey = "registrationOrder" | "attendanceNumber" | string

/**
 * 成績算出結果の一覧テーブル
 *
 * 生徒ごとの各評価項目パーセンテージ・成績ラベルを表示する（評定も評価項目の一つ）。
 * 各列ヘッダーをクリックしてソート可能。
 */
export function ResultsTable({
  result,
  constraints = [],
  onGradeOverride,
  onRefreezeCell,
  onUnfreezeCell,
}: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("registrationOrder")
  const [sortAsc, setSortAsc] = useState(true)

  // 制約ルールを評価。違反（gradeStudentId → 違反一覧）と、評価できなかったルールの理由を得る
  const constraintEvaluation = useMemo(
    () => evaluateConstraints(result, constraints),
    [result, constraints]
  )
  const violationsByStudent = constraintEvaluation.violations

  // 凡例に表示する有効ルール
  const activeConstraints = useMemo(
    () => constraints.filter((constraint) => constraint.enabled),
    [constraints]
  )

  // 評価項目ごとのboundaryLabels（minPercentage降順）を算出
  const boundaryLabelsMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const boundarySet of result.boundarySets ?? []) {
      map[boundarySet.gradeItemId] = boundarySet.boundaries.map(
        (boundary) => boundary.label
      )
    }
    return map
  }, [result.boundarySets])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(key === "registrationOrder" || key === "attendanceNumber")
    }
  }

  // 登録順（result.students の元順序）の1始まり順位を対象者で引ける Map。
  // レンダー毎・比較毎の indexOf(O(n)) を避けるため一度だけ構築する。
  const registrationRankByGradeStudentId = useMemo(
    () =>
      new Map(
        result.students.map((student, index) => [student.gradeStudentId, index])
      ),
    [result.students]
  )

  const sortedStudents = [...result.students].sort((studentA, studentB) => {
    if (sortKey === "registrationOrder") {
      const aIndex =
        registrationRankByGradeStudentId.get(studentA.gradeStudentId) ?? 0
      const bIndex =
        registrationRankByGradeStudentId.get(studentB.gradeStudentId) ?? 0
      return sortAsc ? aIndex - bIndex : bIndex - aIndex
    }
    let comparison = 0
    if (sortKey === "attendanceNumber") {
      comparison =
        (studentA.attendanceNumber ?? 999) - (studentB.attendanceNumber ?? 999)
    } else {
      const aItemResult = studentA.gradeItemResults.find(
        (itemResult) => itemResult.gradeItemId === sortKey
      )
      const bItemResult = studentB.gradeItemResults.find(
        (itemResult) => itemResult.gradeItemId === sortKey
      )
      comparison =
        (aItemResult?.percentage ?? -1) - (bItemResult?.percentage ?? -1)
    }
    return sortAsc ? comparison : -comparison
  })

  const SortHeader = ({
    label,
    sortId,
  }: {
    label: string
    sortId: SortKey
  }) => (
    <th
      className="cursor-pointer px-2 py-2 text-center font-medium hover:underline"
      onClick={() => handleSort(sortId)}
    >
      {label}
      {sortKey === sortId && (sortAsc ? " ↑" : " ↓")}
    </th>
  )

  return (
    <>
      {activeConstraints.length > 0 && (
        <ConstraintLegend
          constraints={activeConstraints}
          errors={constraintEvaluation.errors}
        />
      )}
      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <SortHeader label="順序" sortId="registrationOrder" />
              <SortHeader label="番号" sortId="attendanceNumber" />
              <th className="px-2 py-2 text-left font-medium">氏名</th>
              {result.gradeItems.map((gradeItem) => (
                <SortHeader
                  key={gradeItem.id}
                  label={gradeItem.name}
                  sortId={gradeItem.id}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((student) => {
              const violations =
                violationsByStudent.get(student.gradeStudentId) ?? []
              const rowColor = violations[0]?.color
              const rowTitle =
                violations.length > 0
                  ? violations
                      .map((violation) =>
                        violation.message
                          ? `${violation.name}: ${violation.message}`
                          : violation.name
                      )
                      .join("\n")
                  : undefined
              return (
                <tr
                  key={student.gradeStudentId}
                  className="border-t"
                  style={rowColor ? { backgroundColor: rowColor } : undefined}
                  title={rowTitle}
                >
                  <td className="text-muted-foreground px-2 py-1.5 text-center">
                    {(registrationRankByGradeStudentId.get(
                      student.gradeStudentId
                    ) ?? 0) + 1}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {student.attendanceNumber ?? "-"}
                  </td>
                  <td className="px-2 py-1.5">
                    {student.lastName} {student.firstName}
                  </td>
                  {result.gradeItems.map((gradeItem) => {
                    const itemResult = student.gradeItemResults.find(
                      (gradeItemResult) =>
                        gradeItemResult.gradeItemId === gradeItem.id
                    )

                    // 除外表示
                    if (itemResult?.isExcluded) {
                      return (
                        <td
                          key={gradeItem.id}
                          className="px-2 py-1.5 text-center"
                        >
                          <span className="text-muted-foreground text-xs italic">
                            除外
                          </span>
                        </td>
                      )
                    }

                    const hasEstimated = itemResult?.sourceScores.some(
                      (sourceScore) => sourceScore.isEstimated
                    )
                    return (
                      <td
                        key={gradeItem.id}
                        className="px-2 py-1.5 text-center"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          {itemResult ? (
                            <GradeItemBreakdownPopover
                              itemResult={itemResult}
                              hasEstimated={!!hasEstimated}
                            />
                          ) : (
                            <span className="w-12 text-right text-xs tabular-nums">
                              -
                            </span>
                          )}
                          <EditableGradeLabel
                            gradeLabel={itemResult?.gradeLabel ?? null}
                            originalLabel={
                              itemResult?.originalGradeLabel ?? null
                            }
                            overrideLabel={
                              itemResult?.overrideGradeLabel ?? null
                            }
                            boundaryLabels={
                              boundaryLabelsMap[gradeItem.id] ?? []
                            }
                            onCommit={(newLabel) =>
                              onGradeOverride({
                                gradeStudentId: student.gradeStudentId,
                                gradeItemId: gradeItem.id,
                                overrideLabel: newLabel,
                              })
                            }
                          />
                          {itemResult?.frozen && (
                            <FrozenCellControl
                              frozen={itemResult.frozen}
                              frozenPercentage={itemResult.percentage}
                              frozenGradeLabel={itemResult.gradeLabel}
                              onRefreeze={() =>
                                onRefreezeCell({
                                  gradeStudentId: student.gradeStudentId,
                                  gradeItemId: gradeItem.id,
                                })
                              }
                              onUnfreeze={() =>
                                onUnfreezeCell({
                                  gradeStudentId: student.gradeStudentId,
                                  gradeItemId: gradeItem.id,
                                })
                              }
                            />
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        {result.students.some((student) =>
          student.gradeItemResults.some((gradeItemResult) =>
            gradeItemResult.sourceScores.some(
              (sourceScore) => sourceScore.isEstimated
            )
          )
        ) && (
          <div className="border-t px-3 py-1.5">
            <span className="text-xs text-amber-600">* 欠測推定を含む</span>
          </div>
        )}
      </div>
    </>
  )
}
