"use client"

import { Fragment, useMemo, useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  GradeCalculationResult,
  StudentGradeResult,
} from "@/types/grade.types"
import type {
  GradeExcelComparisonCell,
  GradeExcelComparisonColumn,
} from "@/types/gradeExport.types"

interface GradeExcelPreviewProps {
  result: GradeCalculationResult
  selectedStudentIds: string[]
  /** 成績一覧に足す比較の列（Excel へ渡すものと同じ値） */
  comparisonColumns: GradeExcelComparisonColumn[]
}

/** gradeSheetCreator と同じ丸め（成績一覧: 小数1桁） */
function round1(value: number | null): number | null {
  return value !== null ? Math.round(value * 10) / 10 : null
}

/** gradeSheetCreator と同じ丸め（詳細: 小数2桁） */
function round2(value: number | null): number | null {
  return value !== null ? Math.round(value * 100) / 100 : null
}

/**
 * 成績算出Excel出力のプレビュー
 *
 * gradeSheetCreator.ts が生成する2シート（成績一覧 / 詳細）を、
 * 試験のExcelプレビューと同じスタイルでReactのテーブルとして描画する。
 * 成績一覧には、評価項目ごとに比較の列（「{比較先} 成績」「変化」）も並べる。
 */
export function GradeExcelPreview({
  result,
  selectedStudentIds,
  comparisonColumns,
}: GradeExcelPreviewProps) {
  const [sheetTab, setSheetTab] = useState<"result" | "detail">("result")

  const selectedSet = useMemo(
    () => new Set(selectedStudentIds),
    [selectedStudentIds]
  )
  const students = useMemo(
    () =>
      result.students.filter((student) => selectedSet.has(student.studentId)),
    [result.students, selectedSet]
  )

  // 評価項目ごとの比較の列と、生徒の値の引き方（対象者 id で引く。並びに依存しない）
  const itemColumns = useMemo(
    () =>
      result.gradeItems.map((gradeItem) => ({
        gradeItem,
        comparisonColumns: comparisonColumns
          .filter(
            (comparisonColumn) => comparisonColumn.gradeItemId === gradeItem.id
          )
          .map((comparisonColumn) => ({
            comparisonColumn,
            cellsByGradeStudentId: new Map(
              comparisonColumn.cells.map((comparisonCell) => [
                comparisonCell.gradeStudentId,
                comparisonCell,
              ])
            ),
          })),
      })),
    [result.gradeItems, comparisonColumns]
  )

  const studentName = (student: StudentGradeResult) =>
    `${student.lastName} ${student.firstName}`

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={sheetTab}
        onValueChange={(value) => setSheetTab(value as "result" | "detail")}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-1 grid w-full grid-cols-2">
          <TabsTrigger value="result" className="text-xs">
            成績一覧
          </TabsTrigger>
          <TabsTrigger value="detail" className="text-xs">
            詳細
          </TabsTrigger>
        </TabsList>

        {/* ── 成績一覧シート ── */}
        <TabsContent value="result" className="mt-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="border px-1 py-0.5 text-left">番号</th>
                <th className="border px-1 py-0.5 text-left">氏名</th>
                {itemColumns.map(
                  ({ gradeItem, comparisonColumns: itemComparisons }) => (
                    <th
                      key={gradeItem.id}
                      colSpan={2 + itemComparisons.length * 2}
                      className="border px-1 py-0.5 text-center"
                    >
                      {gradeItem.name}
                    </th>
                  )
                )}
              </tr>
              <tr>
                <th className="border px-1 py-0.5" />
                <th className="border px-1 py-0.5" />
                {itemColumns.map(
                  ({ gradeItem, comparisonColumns: itemComparisons }) => (
                    <ResultSubHeader
                      key={gradeItem.id}
                      comparisonColumns={itemComparisons.map(
                        ({ comparisonColumn }) => comparisonColumn
                      )}
                    />
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.studentId} className="hover:bg-muted/50">
                  <td className="border px-1 py-0.5 text-center">
                    {student.attendanceNumber ?? "-"}
                  </td>
                  <td className="border px-1 py-0.5 whitespace-nowrap">
                    {studentName(student)}
                  </td>
                  {itemColumns.map(
                    ({ gradeItem, comparisonColumns: itemComparisons }) => {
                      const itemResult = student.gradeItemResults.find(
                        (gradeItemResult) =>
                          gradeItemResult.gradeItemId === gradeItem.id
                      )
                      const comparisonCells = itemComparisons.map(
                        ({ comparisonColumn, cellsByGradeStudentId }) => (
                          <ComparisonCells
                            key={comparisonColumn.comparisonId}
                            comparisonCell={cellsByGradeStudentId.get(
                              student.gradeStudentId
                            )}
                          />
                        )
                      )
                      if (itemResult?.isExcluded) {
                        return (
                          <Fragment key={gradeItem.id}>
                            <ExcludedCells count={2} />
                            {comparisonCells}
                          </Fragment>
                        )
                      }
                      const percentage = round1(itemResult?.percentage ?? null)
                      const allMissing = itemResult?.isAllMissing ?? false
                      const colorClass = allMissing ? "text-red-500" : ""
                      return (
                        <Fragment key={gradeItem.id}>
                          <ResultCells
                            percentage={percentage}
                            label={itemResult?.gradeLabel ?? null}
                            className={colorClass}
                          />
                          {comparisonCells}
                        </Fragment>
                      )
                    }
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        {/* ── 詳細シート ── */}
        <TabsContent value="detail" className="mt-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="border px-1 py-0.5 text-left">番号</th>
                <th className="border px-1 py-0.5 text-left">氏名</th>
                {result.gradeItems.map((gradeItem) => (
                  <th
                    key={gradeItem.id}
                    colSpan={gradeItem.dataSources.length + 1}
                    className="border px-1 py-0.5 text-center"
                  >
                    {gradeItem.name}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="border px-1 py-0.5" />
                <th className="border px-1 py-0.5" />
                {result.gradeItems.map((gradeItem) => (
                  <DetailSubHeaders
                    key={gradeItem.id}
                    dataSources={gradeItem.dataSources}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.studentId} className="hover:bg-muted/50">
                  <td className="border px-1 py-0.5 text-center">
                    {student.attendanceNumber ?? "-"}
                  </td>
                  <td className="border px-1 py-0.5 whitespace-nowrap">
                    {studentName(student)}
                  </td>
                  {result.gradeItems.map((gradeItem) => {
                    const itemResult = student.gradeItemResults.find(
                      (gradeItemResult) =>
                        gradeItemResult.gradeItemId === gradeItem.id
                    )
                    if (itemResult?.isExcluded) {
                      return (
                        <ExcludedCells
                          key={gradeItem.id}
                          count={gradeItem.dataSources.length + 1}
                        />
                      )
                    }
                    return (
                      <DetailCells
                        key={gradeItem.id}
                        gradeItemResult={itemResult}
                        dataSources={gradeItem.dataSources}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ResultSubHeader({
  comparisonColumns,
}: {
  comparisonColumns: GradeExcelComparisonColumn[]
}) {
  return (
    <>
      <th className="border px-1 py-0.5 text-right font-normal">(%)</th>
      <th className="border px-1 py-0.5 text-right font-normal">成績</th>
      {comparisonColumns.map((comparisonColumn) => (
        <Fragment key={comparisonColumn.comparisonId}>
          <th className="border px-1 py-0.5 text-right font-normal whitespace-nowrap">
            {comparisonColumn.comparedTargetName} 成績
          </th>
          <th className="border px-1 py-0.5 text-center font-normal">変化</th>
        </Fragment>
      ))}
    </>
  )
}

/** 比較1件分の2マス（比較先の成績・変化の記号） */
function ComparisonCells({
  comparisonCell,
}: {
  comparisonCell: GradeExcelComparisonCell | undefined
}) {
  return (
    <>
      <td className="border px-1 py-0.5 text-right">
        {comparisonCell?.comparedGradeLabel ?? "-"}
      </td>
      <td className="border px-1 py-0.5 text-center">
        {comparisonCell?.symbol ?? ""}
      </td>
    </>
  )
}

function ResultCells({
  percentage,
  label,
  className = "",
}: {
  percentage: number | null
  label: string | null
  className?: string
}) {
  return (
    <>
      <td className={`border px-1 py-0.5 text-right ${className}`}>
        {percentage ?? "-"}
      </td>
      <td className={`border px-1 py-0.5 text-right ${className}`}>
        {label ?? "-"}
      </td>
    </>
  )
}

function DetailSubHeaders({
  dataSources,
}: {
  dataSources: GradeCalculationResult["gradeItems"][number]["dataSources"]
}) {
  return (
    <>
      {dataSources.map((dataSource) => (
        // key は安定した id（表示名は重複しうる）
        <VerticalHeader key={dataSource.id} normal>
          {dataSource.name}
        </VerticalHeader>
      ))}
      <VerticalHeader>合計</VerticalHeader>
    </>
  )
}

/**
 * 縦書きのヘッダーセル（番号・氏名以外の詳細シート2段目用）。
 * 名前が長く横幅を取るため writing-mode: vertical-rl で縦書きにする。
 */
function VerticalHeader({
  children,
  normal = false,
}: {
  children: React.ReactNode
  normal?: boolean
}) {
  return (
    <th
      className={`border px-1 py-0.5 text-center align-middle ${
        normal ? "font-normal" : ""
      }`}
    >
      <span className="inline-block whitespace-nowrap [writing-mode:vertical-rl]">
        {children}
      </span>
    </th>
  )
}

function DetailCells({
  gradeItemResult,
  dataSources,
}: {
  gradeItemResult:
    | GradeCalculationResult["students"][number]["gradeItemResults"][number]
    | undefined
  dataSources: GradeCalculationResult["gradeItems"][number]["dataSources"]
}) {
  // 列は評価項目の dataSources が決める。値は添字ではなく dataSourceId で引くので、
  // 生徒ごとに sourceScores の並びや件数が違っても対応がずれない。
  const cells: React.ReactNode[] = dataSources.map((dataSource) => {
    const sourceScore = gradeItemResult?.sourceScores.find(
      (sourceScore) => sourceScore.dataSourceId === dataSource.id
    )
    const value = sourceScore ? (round2(sourceScore.weightedScore) ?? "-") : "-"
    const estimated = sourceScore?.isEstimated ?? false
    return (
      <td
        key={dataSource.id}
        className={`border px-1 py-0.5 text-right ${
          estimated ? "text-amber-600 italic" : ""
        }`}
        title={estimated ? "欠測推定値" : undefined}
      >
        {value}
      </td>
    )
  })
  cells.push(
    <td key="total" className="border px-1 py-0.5 text-right font-medium">
      {round2(gradeItemResult?.weightedScore ?? null) ?? "-"}
    </td>
  )
  return <>{cells}</>
}

function ExcludedCells({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <td
          key={i}
          className="border bg-muted/50 px-1 py-0.5 text-right text-muted-foreground italic"
        >
          除外
        </td>
      ))}
    </>
  )
}
