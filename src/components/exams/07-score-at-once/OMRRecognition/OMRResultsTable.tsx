"use client"

import { CheckCircle2, CopyX, MinusCircle, XCircle } from "lucide-react"

import type { OMRCellResult, OMRSheetResult } from "@/types/omr.types"

interface OMRResultsTableProps {
  sheetResults: OMRSheetResult[]
  /** セル行クリック時のコールバック */
  onCellClick?: (
    studentId: string | undefined,
    cellResult: OMRCellResult
  ) => void
}

function StatusIcon({ status }: { status: OMRCellResult["autoScoreStatus"] }) {
  switch (status) {
    case "correct":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case "incorrect":
      return <XCircle className="h-4 w-4 text-red-500" />
    case "ambiguous":
      return <CopyX className="h-4 w-4 text-orange-500" />
    case "no_answer":
      return <MinusCircle className="text-muted-foreground h-4 w-4" />
    default:
      return null
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-600"
  if (confidence >= 0.5) return "text-yellow-600"
  return "text-red-600"
}

export function OMRResultsTable({
  sheetResults,
  onCellClick,
}: OMRResultsTableProps) {
  if (sheetResults.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        認識結果がありません。認識を実行してください。
      </div>
    )
  }

  return (
    <div className="max-h-[500px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left font-medium">生徒</th>
            <th className="px-3 py-2 text-left font-medium">設問</th>
            <th className="px-3 py-2 text-left font-medium">認識結果</th>
            <th className="px-3 py-2 text-center font-medium">信頼度</th>
            <th className="px-3 py-2 text-center font-medium">判定</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sheetResults.map((sheet, si) => {
            if (!sheet.success) {
              return (
                <tr key={si} className="bg-red-50/50">
                  <td className="px-3 py-1.5">
                    {sheet.studentId ?? `答案 ${si + 1}`}
                  </td>
                  <td colSpan={4} className="px-3 py-1.5 text-red-600">
                    {sheet.error ?? "認識に失敗しました"}
                  </td>
                </tr>
              )
            }

            return sheet.cellResults.map((cell, ci) => (
              <tr
                key={`${si}-${ci}`}
                className="hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onCellClick?.(sheet.studentId, cell)}
              >
                {ci === 0 ? (
                  <td
                    className="px-3 py-1.5 font-medium"
                    rowSpan={sheet.cellResults.length}
                  >
                    {sheet.studentId ?? `答案 ${si + 1}`}
                  </td>
                ) : null}
                <td className="px-3 py-1.5">{cell.label}</td>
                <td className="px-3 py-1.5">
                  {cell.recognizedValues.length > 0
                    ? cell.recognizedValues.join(", ")
                    : "-"}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <span className={confidenceColor(cell.confidence)}>
                    {(cell.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center justify-center">
                    <StatusIcon status={cell.autoScoreStatus} />
                  </div>
                </td>
              </tr>
            ))
          })}
        </tbody>
      </table>
    </div>
  )
}
