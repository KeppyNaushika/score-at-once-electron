"use client"

import { useMemo, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { evaluateConstraints } from "@/lib/gradeConstraints"
import type {
  GradeCalculationResult,
  GradeCellTarget,
  GradeConstraintData,
  GradeOverrideInput,
} from "@/types/grade.types"

import { ComparisonMarks } from "./ComparisonMarks"
import { ConstraintLegend } from "./ConstraintLegend"
import { EditableGradeLabel } from "./EditableGradeLabel"
import { FrozenCellControl } from "./FrozenCellControl"
import { GradeItemBreakdownPopover } from "./GradeItemBreakdownPopover"
import type { ComparisonDisplay, ComparisonMarksByCell } from "./types"

interface ResultsTableProps {
  result: GradeCalculationResult
  constraints?: GradeConstraintData[]
  /** 比較の記号（対象者×評価項目）。null なら出さない */
  comparisonMarks?: ComparisonMarksByCell | null
  /** 比較の記号の出し方（出さないときは comparisonMarks を null にする） */
  comparisonDisplay?: Exclude<ComparisonDisplay, "none">
  onGradeOverride: (params: GradeOverrideInput) => void
  /** 対象セルを現在のライブ値で確定し直す */
  onRefreezeCell: (target: GradeCellTarget) => void
  /** 対象セルの確定を解除する */
  onUnfreezeCell: (target: GradeCellTarget) => void
}

type SortKey = "registrationOrder" | "attendanceNumber" | string

/** ソート状態を示す列ヘッダー。クリックでソート対象を切り替える */
const SortHeader = ({
  label,
  sortId,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string
  sortId: SortKey
  sortKey: SortKey
  sortAsc: boolean
  onSort: (sortId: SortKey) => void
}) => (
  <TableHead
    className="h-auto cursor-pointer bg-transparent px-2 py-2 text-center whitespace-normal hover:underline"
    onClick={() => onSort(sortId)}
  >
    {label}
    {sortKey === sortId && (sortAsc ? " ↑" : " ↓")}
  </TableHead>
)

/**
 * 成績算出結果の一覧テーブル
 *
 * 生徒ごとの各評価項目パーセンテージ・成績ラベルを表示する（評定も評価項目の一つ）。
 * 各列ヘッダーをクリックしてソート可能。
 */
export function ResultsTable({
  result,
  constraints = [],
  comparisonMarks = null,
  comparisonDisplay = "symbol",
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
    let comparison: number
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

  return (
    <>
      {activeConstraints.length > 0 && (
        <ConstraintLegend
          constraints={activeConstraints}
          errors={constraintEvaluation.errors}
        />
      )}
      <div className="mt-6 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <SortHeader
                label="順序"
                sortId="registrationOrder"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
              <SortHeader
                label="番号"
                sortId="attendanceNumber"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onSort={handleSort}
              />
              <TableHead className="h-auto bg-transparent px-2 py-2 whitespace-normal">
                氏名
              </TableHead>
              {result.gradeItems.map((gradeItem) => (
                <SortHeader
                  key={gradeItem.id}
                  label={gradeItem.name}
                  sortId={gradeItem.id}
                  sortKey={sortKey}
                  sortAsc={sortAsc}
                  onSort={handleSort}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
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
                <TableRow
                  key={student.gradeStudentId}
                  style={rowColor ? { backgroundColor: rowColor } : undefined}
                  title={rowTitle}
                >
                  <TableCell className="px-2 py-1.5 text-center text-muted-foreground">
                    {(registrationRankByGradeStudentId.get(
                      student.gradeStudentId
                    ) ?? 0) + 1}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 text-center">
                    {student.attendanceNumber ?? "-"}
                  </TableCell>
                  <TableCell className="px-2 py-1.5 whitespace-normal">
                    {student.lastName} {student.firstName}
                  </TableCell>
                  {result.gradeItems.map((gradeItem) => {
                    const itemResult = student.gradeItemResults.find(
                      (gradeItemResult) =>
                        gradeItemResult.gradeItemId === gradeItem.id
                    )

                    // 除外表示
                    if (itemResult?.isExcluded) {
                      return (
                        <TableCell
                          key={gradeItem.id}
                          className="px-2 py-1.5 text-center"
                        >
                          <span className="text-xs text-muted-foreground italic">
                            除外
                          </span>
                        </TableCell>
                      )
                    }

                    const hasEstimated = itemResult?.sourceScores.some(
                      (sourceScore) => sourceScore.isEstimated
                    )
                    const cellComparisonMarks = comparisonMarks
                      ?.get(student.gradeStudentId)
                      ?.get(gradeItem.id)
                    return (
                      <TableCell
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
                            boundaries={gradeItem.boundaries}
                            onCommit={(newLabel) =>
                              onGradeOverride({
                                gradeStudentId: student.gradeStudentId,
                                gradeItemId: gradeItem.id,
                                overrideLabel: newLabel,
                              })
                            }
                          />
                          {cellComparisonMarks && (
                            <ComparisonMarks
                              marks={cellComparisonMarks}
                              currentGradeLabel={itemResult?.gradeLabel ?? null}
                              currentPercentage={itemResult?.percentage ?? null}
                              display={comparisonDisplay}
                            />
                          )}
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
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
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
