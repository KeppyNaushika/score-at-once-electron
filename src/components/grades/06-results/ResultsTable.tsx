"use client"

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { evaluateConstraints } from "@/lib/gradeConstraints"
import type {
  GradeCalculationResult,
  GradeConstraintData,
  GradeItemResult,
} from "@/types/grade.types"

interface ResultsTableProps {
  result: GradeCalculationResult
  constraints?: GradeConstraintData[]
  onGradeOverride: (params: {
    studentId: string
    targetType: "grade_item" | "overall"
    gradeItemId: string | null
    overrideLabel: string | null
  }) => void
}

type SortKey = "registrationOrder" | "attendanceNumber" | string

// ---------------------------------------------------------------------------
// ScoreBreakdownPopover – %クリックで算出根拠を表示
// ---------------------------------------------------------------------------

/** GradeItem列の%ポップオーバー: データソース別の内訳 */
function GradeItemBreakdownPopover({
  itemResult,
  hasEstimated,
}: {
  itemResult: GradeItemResult
  hasEstimated: boolean
}) {
  const pctText =
    itemResult.percentage !== null && itemResult.percentage !== undefined
      ? `${itemResult.percentage.toFixed(1)}%${hasEstimated ? "*" : ""}`
      : "-"

  const colorClass = itemResult.isAllMissing
    ? "text-red-500"
    : hasEstimated
      ? "text-amber-600"
      : ""

  if (itemResult.sourceScores.length === 0) {
    return (
      <span className={`w-12 text-right text-xs tabular-nums ${colorClass}`}>
        {pctText}
      </span>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-12 cursor-pointer text-right text-xs tabular-nums hover:underline ${colorClass}`}
          title="クリックで内訳を表示"
        >
          {pctText}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="mb-1 text-xs font-semibold">{itemResult.gradeItemName}</p>
        <p className="text-muted-foreground mb-2 text-[10px]">
          換算 = (素点 ÷ 満点) × 換算満点 ※欠点は除外
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="pb-1 text-left font-medium">項目</th>
              <th className="pb-1 text-right font-medium">素点</th>
              <th className="pb-1 text-right font-medium">満点</th>
              <th className="pb-1 text-right font-medium">換算満点</th>
              <th className="pb-1 text-right font-medium">換算</th>
            </tr>
          </thead>
          <tbody>
            {itemResult.sourceScores.map((sourceScore) => {
              const isMissing = sourceScore.weightedScore === null
              return (
                <tr
                  key={sourceScore.dataSourceId}
                  className={`border-b last:border-0 ${isMissing ? "text-muted-foreground line-through" : ""}`}
                >
                  <td className="py-1 pr-1">
                    {sourceScore.dataSourceName}
                    {sourceScore.isEstimated && (
                      <span className="ml-0.5 text-amber-600">*</span>
                    )}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {sourceScore.rawScore !== null ? sourceScore.rawScore : "-"}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {sourceScore.maxScore}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {sourceScore.weight}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {sourceScore.weightedScore !== null
                      ? sourceScore.weightedScore.toFixed(2)
                      : "欠"}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td className="pt-1" colSpan={4}>
                換算合計（欠点除外）
              </td>
              <td className="pt-1 text-right tabular-nums">
                {itemResult.weightedScore !== null
                  ? itemResult.weightedScore.toFixed(2)
                  : "-"}
              </td>
            </tr>
            <tr className="text-muted-foreground">
              <td className="pt-0.5" colSpan={4}>
                換算満点合計（欠点除外）
              </td>
              <td className="pt-0.5 text-right tabular-nums">
                {itemResult.weightedMaxScore.toFixed(1)}
              </td>
            </tr>
            <tr className="font-medium">
              <td className="pt-1" colSpan={4}>
                得点率
              </td>
              <td className="pt-1 text-right tabular-nums">
                {itemResult.percentage !== null
                  ? `${itemResult.percentage.toFixed(1)}%`
                  : "-"}
              </td>
            </tr>
          </tfoot>
        </table>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// EditableGradeLabel
// ---------------------------------------------------------------------------

interface EditableGradeLabelProps {
  /** 実効値 */
  gradeLabel: string | null
  /** 自動算出値 */
  originalLabel: string | null
  /** 上書き値 */
  overrideLabel: string | null
  /** 境界ラベル配列（minPercentage降順） */
  boundaryLabels: string[]
  onCommit: (newLabel: string | null) => void
}

function EditableGradeLabel({
  gradeLabel,
  originalLabel,
  overrideLabel,
  boundaryLabels,
  onCommit,
}: EditableGradeLabelProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = useCallback(() => {
    setEditValue("")
    setEditing(true)
  }, [])

  const commit = useCallback(() => {
    setEditing(false)
    const trimmed = editValue.trim()
    if (trimmed === "") {
      // 空文字 → 上書き解除
      if (overrideLabel !== null) {
        onCommit(null)
      }
    } else if (trimmed !== gradeLabel) {
      // 算定値と同値でもoverrideとして保存（固定用途）
      onCommit(trimmed)
    }
  }, [editValue, overrideLabel, gradeLabel, onCommit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        commit()
      } else if (e.key === "Escape") {
        e.preventDefault()
        setEditing(false)
      }
    },
    [commit]
  )

  if (!gradeLabel && !overrideLabel) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="border-primary w-12 rounded border bg-white px-1 py-0.5 text-center text-xs focus:outline-none"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={gradeLabel ?? ""}
        autoFocus
      />
    )
  }

  const isOverridden = overrideLabel !== null
  const tooltipText = isOverridden
    ? `自動算出: ${originalLabel ?? "-"} → 手動: ${overrideLabel}`
    : undefined

  // Override方向の判定
  let overrideDirection: "up" | "down" | "fixed" | "custom" | null = null
  if (isOverridden && originalLabel && overrideLabel) {
    const originalIndex = boundaryLabels.indexOf(originalLabel)
    const overrideIndex = boundaryLabels.indexOf(overrideLabel)
    if (originalIndex !== -1 && overrideIndex !== -1) {
      if (overrideIndex < originalIndex) overrideDirection = "up"
      else if (overrideIndex > originalIndex) overrideDirection = "down"
      else overrideDirection = "fixed"
    } else {
      overrideDirection = "custom"
    }
  } else if (isOverridden) {
    overrideDirection = "custom"
  }

  return (
    <Badge
      variant={isOverridden ? "default" : "outline"}
      className={`cursor-pointer text-xs ${
        isOverridden
          ? "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
          : "hover:bg-muted"
      }`}
      title={tooltipText}
      onClick={startEdit}
    >
      {gradeLabel}
      {overrideDirection === "up" && (
        <ArrowUp className="ml-0.5 inline h-3 w-3 text-emerald-600" />
      )}
      {overrideDirection === "down" && (
        <ArrowDown className="ml-0.5 inline h-3 w-3 text-rose-600" />
      )}
      {overrideDirection === "fixed" && (
        <ArrowRight className="ml-0.5 inline h-3 w-3 text-amber-600" />
      )}
      {overrideDirection === "custom" && "*"}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// ResultsTable
// ---------------------------------------------------------------------------

/**
 * 成績算出結果の一覧テーブル
 *
 * 生徒ごとの各評価項目パーセンテージ・成績ラベル・総合成績を表示する。
 * 各列ヘッダーをクリックしてソート可能。
 */
export function ResultsTable({
  result,
  constraints = [],
  onGradeOverride,
}: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("registrationOrder")
  const [sortAsc, setSortAsc] = useState(true)

  // 制約ルール違反を評価（studentId → 違反一覧）
  const violationsByStudent = useMemo(
    () => evaluateConstraints(result, constraints).violations,
    [result, constraints]
  )

  // 凡例に表示する有効ルール
  const activeConstraints = useMemo(
    () => constraints.filter((constraint) => constraint.enabled),
    [constraints]
  )

  // 各列に対応するboundaryLabels（minPercentage降順）を算出
  const boundaryLabelsMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const boundarySet of result.boundarySets ?? []) {
      const key =
        boundarySet.targetType === "overall"
          ? "__overall__"
          : (boundarySet.gradeItemId ?? "__unknown__")
      map[key] = boundarySet.boundaries.map((boundary) => boundary.label)
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

  // 登録順（result.students の元順序）の1始まり順位を studentId で引ける Map。
  // レンダー毎・比較毎の indexOf(O(n)) を避けるため一度だけ構築する。
  const registrationRankByStudentId = useMemo(
    () =>
      new Map(
        result.students.map((student, index) => [student.studentId, index])
      ),
    [result.students]
  )

  const sortedStudents = [...result.students].sort((studentA, studentB) => {
    if (sortKey === "registrationOrder") {
      const aIndex = registrationRankByStudentId.get(studentA.studentId) ?? 0
      const bIndex = registrationRankByStudentId.get(studentB.studentId) ?? 0
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
        <ConstraintLegend constraints={activeConstraints} />
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
                violationsByStudent.get(student.studentId) ?? []
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
                  key={student.studentId}
                  className="border-t"
                  style={rowColor ? { backgroundColor: rowColor } : undefined}
                  title={rowTitle}
                >
                  <td className="text-muted-foreground px-2 py-1.5 text-center">
                    {(registrationRankByStudentId.get(student.studentId) ?? 0) +
                      1}
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
                                studentId: student.studentId,
                                targetType: "grade_item",
                                gradeItemId: gradeItem.id,
                                overrideLabel: newLabel,
                              })
                            }
                          />
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

/** 制約ルールの色凡例 */
function ConstraintLegend({
  constraints,
}: {
  constraints: GradeConstraintData[]
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <span className="text-muted-foreground">制約ルール:</span>
      {constraints.map((constraint) => (
        <span key={constraint.id} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded border"
            style={{ backgroundColor: constraint.color }}
          />
          {constraint.name}
        </span>
      ))}
    </div>
  )
}
