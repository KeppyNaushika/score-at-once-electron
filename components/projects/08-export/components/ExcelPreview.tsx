"use client"

import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { ExcelPreviewData } from "../hooks/useExcelPreview"

function getStatusSymbol(status: string, score?: number | null): string {
  switch (status) {
    case "correct":
      return "○"
    case "partial":
    case "hold":
      return score != null ? `△${score}` : "△NULL"
    case "incorrect":
      return "×"
    case "no_answer":
      return "-"
    default:
      return "-"
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "correct":
      return "text-blue-600"
    case "partial":
    case "hold":
      return "text-amber-600"
    case "incorrect":
      return "text-red-600"
    case "no_answer":
      return "text-gray-400"
    default:
      return "text-gray-400"
  }
}

interface ExcelPreviewProps {
  data: ExcelPreviewData
}

export function ExcelPreview({ data }: ExcelPreviewProps) {
  const [sheetTab, setSheetTab] = useState<"scores" | "results">("scores")

  const hasSubtotals = data.headers.subtotalLabels.length > 0

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={sheetTab}
        onValueChange={(v) => setSheetTab(v as "scores" | "results")}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-1 grid w-full grid-cols-2">
          <TabsTrigger value="scores" className="text-xs">
            点数一覧
          </TabsTrigger>
          <TabsTrigger value="results" className="text-xs">
            正誤一覧
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="border px-1 py-0.5 text-left">#</th>
                <th className="border px-1 py-0.5 text-left">氏名</th>
                <th className="border px-1 py-0.5 text-right">合計</th>
                {hasSubtotals &&
                  data.headers.subtotalLabels.map((label, i) => (
                    <th
                      key={`sub-${i}`}
                      className="border px-1 py-0.5 text-right"
                    >
                      {label}
                    </th>
                  ))}
                {data.headers.questionLabels.map((label, i) => (
                  <th key={i} className="border px-1 py-0.5 text-right">
                    <div>{label}</div>
                    <div className="text-muted-foreground font-normal">
                      ({data.headers.questionMaxScores[i]})
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIdx) => (
                <tr key={row.studentId} className="hover:bg-muted/50">
                  <td className="border px-1 py-0.5 text-center">
                    {rowIdx + 1}
                  </td>
                  <td className="border px-1 py-0.5 whitespace-nowrap">
                    {row.studentName}
                  </td>
                  <td className="border px-1 py-0.5 text-right font-medium">
                    {row.totalScore ?? "-"}
                  </td>
                  {hasSubtotals &&
                    data.headers.subtotalLabels.map((_, i) => {
                      const sub = row.subtotalScores[i]
                      return (
                        <td
                          key={`sub-${i}`}
                          className="border px-1 py-0.5 text-right"
                        >
                          {sub?.score ?? "-"}
                        </td>
                      )
                    })}
                  {row.scores.map((score, i) => (
                    <td key={i} className="border px-1 py-0.5 text-right">
                      {score.score ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="results" className="mt-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="border px-1 py-0.5 text-left">#</th>
                <th className="border px-1 py-0.5 text-left">氏名</th>
                <th className="border px-1 py-0.5 text-right">合計</th>
                {hasSubtotals &&
                  data.headers.subtotalLabels.map((label, i) => (
                    <th
                      key={`sub-${i}`}
                      className="border px-1 py-0.5 text-right"
                    >
                      {label}
                    </th>
                  ))}
                {data.headers.questionLabels.map((label, i) => (
                  <th key={i} className="border px-1 py-0.5 text-center">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIdx) => (
                <tr key={row.studentId} className="hover:bg-muted/50">
                  <td className="border px-1 py-0.5 text-center">
                    {rowIdx + 1}
                  </td>
                  <td className="border px-1 py-0.5 whitespace-nowrap">
                    {row.studentName}
                  </td>
                  <td className="border px-1 py-0.5 text-right font-medium">
                    {row.totalScore ?? "-"}
                  </td>
                  {hasSubtotals &&
                    data.headers.subtotalLabels.map((_, i) => {
                      const sub = row.subtotalScores[i]
                      return (
                        <td
                          key={`sub-${i}`}
                          className="border px-1 py-0.5 text-right"
                        >
                          {sub?.score ?? "-"}
                        </td>
                      )
                    })}
                  {row.scores.map((score, i) => (
                    <td
                      key={i}
                      className={`border px-1 py-0.5 text-center ${getStatusColor(score.status)}`}
                    >
                      {getStatusSymbol(score.status, score.score)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </div>
  )
}
