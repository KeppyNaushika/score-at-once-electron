"use client"

import { useMemo, useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  GradeCalculationResult,
  StudentGradeResult,
} from "@/types/grade.types"

interface GradeExcelPreviewProps {
  result: GradeCalculationResult
  selectedStudentIds: string[]
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
 */
export function GradeExcelPreview({
  result,
  selectedStudentIds,
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

  // 詳細シートの列構成（GradeItemごとのデータソース名）。
  // 除外などで空にならないよう、各GradeItemで非除外の結果を持つ生徒から導出する。
  const detailColumns = useMemo(
    () =>
      result.gradeItems.map((gradeItem) => {
        let sourceNames: string[] = []
        for (const student of result.students) {
          const gradeItemResult = student.gradeItemResults.find(
            (gradeItemResult) => gradeItemResult.gradeItemId === gradeItem.id
          )
          if (
            gradeItemResult &&
            !gradeItemResult.isExcluded &&
            gradeItemResult.sourceScores.length > 0
          ) {
            sourceNames = gradeItemResult.sourceScores.map(
              (sourceScore) => sourceScore.dataSourceName
            )
            break
          }
        }
        return { gradeItem, sourceNames }
      }),
    [result.gradeItems, result.students]
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
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="border px-1 py-0.5 text-left">番号</th>
                <th className="border px-1 py-0.5 text-left">氏名</th>
                {result.gradeItems.map((gradeItem) => (
                  <th
                    key={gradeItem.id}
                    colSpan={2}
                    className="border px-1 py-0.5 text-center"
                  >
                    {gradeItem.name}
                  </th>
                ))}
                <th colSpan={2} className="border px-1 py-0.5 text-center">
                  総合
                </th>
              </tr>
              <tr>
                <th className="border px-1 py-0.5" />
                <th className="border px-1 py-0.5" />
                {result.gradeItems.map((gradeItem) => (
                  <ResultSubHeader key={gradeItem.id} />
                ))}
                <ResultSubHeader />
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
                      return <ExcludedCells key={gradeItem.id} count={2} />
                    }
                    const percentage = round1(itemResult?.percentage ?? null)
                    const allMissing = itemResult?.isAllMissing ?? false
                    const colorClass = allMissing ? "text-red-500" : ""
                    return (
                      <ResultCells
                        key={gradeItem.id}
                        percentage={percentage}
                        label={itemResult?.gradeLabel ?? null}
                        className={colorClass}
                      />
                    )
                  })}
                  <ResultCells
                    percentage={round1(student.overallPercentage)}
                    label={student.overallGradeLabel}
                    className="font-medium"
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        {/* ── 詳細シート ── */}
        <TabsContent value="detail" className="mt-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="border px-1 py-0.5 text-left">番号</th>
                <th className="border px-1 py-0.5 text-left">氏名</th>
                {detailColumns.map(({ gradeItem, sourceNames }) => (
                  <th
                    key={gradeItem.id}
                    colSpan={sourceNames.length + 1}
                    className="border px-1 py-0.5 text-center"
                  >
                    {gradeItem.name}
                  </th>
                ))}
                <th className="border px-1 py-0.5 text-center">総合</th>
              </tr>
              <tr>
                <th className="border px-1 py-0.5" />
                <th className="border px-1 py-0.5" />
                {detailColumns.map(({ gradeItem, sourceNames }) => (
                  <DetailSubHeaders
                    key={gradeItem.id}
                    sourceNames={sourceNames}
                  />
                ))}
                <VerticalHeader>合計</VerticalHeader>
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
                  {detailColumns.map(({ gradeItem, sourceNames }) => {
                    const itemResult = student.gradeItemResults.find(
                      (gradeItemResult) =>
                        gradeItemResult.gradeItemId === gradeItem.id
                    )
                    if (itemResult?.isExcluded) {
                      return (
                        <ExcludedCells
                          key={gradeItem.id}
                          count={sourceNames.length + 1}
                        />
                      )
                    }
                    return (
                      <DetailCells
                        key={gradeItem.id}
                        gir={itemResult}
                        sourceCount={sourceNames.length}
                      />
                    )
                  })}
                  <td className="border px-1 py-0.5 text-right font-medium">
                    {round2(student.overallScore) ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ResultSubHeader() {
  return (
    <>
      <th className="border px-1 py-0.5 text-right font-normal">%</th>
      <th className="border px-1 py-0.5 text-right font-normal">成績</th>
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

function DetailSubHeaders({ sourceNames }: { sourceNames: string[] }) {
  return (
    <>
      {sourceNames.map((name, i) => (
        <VerticalHeader key={i} normal>
          {name}
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
  gir,
  sourceCount,
}: {
  gir:
    | GradeCalculationResult["students"][number]["gradeItemResults"][number]
    | undefined
  sourceCount: number
}) {
  // 表示する列数を sourceCount に合わせる（生徒間で列数を揃える）
  const cells: React.ReactNode[] = []
  for (let i = 0; i < sourceCount; i++) {
    const sourceScore = gir?.sourceScores[i]
    const value = sourceScore ? (round2(sourceScore.weightedScore) ?? "-") : "-"
    const estimated = sourceScore?.isEstimated ?? false
    cells.push(
      <td
        key={i}
        className={`border px-1 py-0.5 text-right ${
          estimated ? "text-amber-600 italic" : ""
        }`}
        title={estimated ? "欠測推定値" : undefined}
      >
        {value}
      </td>
    )
  }
  cells.push(
    <td key="total" className="border px-1 py-0.5 text-right font-medium">
      {round2(gir?.weightedScore ?? null) ?? "-"}
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
          className="text-muted-foreground bg-muted/50 border px-1 py-0.5 text-right italic"
        >
          除外
        </td>
      ))}
    </>
  )
}
