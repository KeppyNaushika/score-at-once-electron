"use client"

import { type ReactNode, useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatScaleValue } from "@/lib/shared/scaleValueDisplay"
import { cn } from "@/lib/utils"
import {
  isStatusCompatibleWithScoringMethod,
  type ScaleValueDisplay,
} from "@/types/rubric.types"

import type { ExcelPreviewData } from "../hooks/useExcelPreview"
import { useItemAnalysis } from "../hooks/useItemAnalysis"
import { useSpAnalysis } from "../hooks/useSpAnalysis"
import { FrequencyDistributionChart } from "./FrequencyDistributionChart"
import { ItemAnalysisPreview } from "./ItemAnalysisPreview"
import { SpTablePreview } from "./SpTablePreview"

function getStatusSymbol(status: string, score?: number | null): string {
  switch (status) {
    case "correct":
      return "○"
    case "partial":
    case "pending":
      return score != null ? `△${score}` : "△"
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
    case "pending":
      return "text-amber-600"
    case "incorrect":
      return "text-red-600"
    case "no_answer":
      return "text-gray-400"
    default:
      return "text-gray-400"
  }
}

type ExcelPreviewScore = ExcelPreviewData["rows"][number]["scores"][number]

/**
 * 正誤一覧のマスの中身。類型評価で類型を付けた設問は、正誤の記号ではなく類型を見せ方に従って出す
 * （Excel の `getScoreCellSymbol` と同じ。docs/vlm-grading-design.md §4-8-8）。方式と合わない採点は
 * 点にならないので「-」
 */
function getResultCellText(
  score: ExcelPreviewScore,
  scaleValueDisplay: ScaleValueDisplay
): string {
  if (score.scaleLevel) {
    return formatScaleValue(
      {
        label: score.scaleLevel.label,
        pointsText: String(score.scaleLevel.score),
      },
      scaleValueDisplay
    )
  }
  if (!isStatusCompatibleWithScoringMethod(score.scoringMethod, score.status)) {
    return "-"
  }
  return getStatusSymbol(score.status, score.score)
}

/** 正誤一覧のマスの色。類型は正誤ではないので記号の色を付けず、方式と合わない採点は無答と同じ灰色 */
function getResultCellColor(score: ExcelPreviewScore): string {
  if (score.scaleLevel) return "text-foreground"
  if (!isStatusCompatibleWithScoringMethod(score.scoringMethod, score.status)) {
    return "text-gray-400"
  }
  return getStatusColor(score.status)
}

/** 設問の列だけが表ごとに違う。見出しと各マスの中身・寄せをここで渡す */
interface QuestionColumnView {
  alignClassName: "text-right" | "text-center"
  renderHeader: (label: string, questionIndex: number) => ReactNode
  renderCell: (score: ExcelPreviewScore) => ReactNode
  cellClassName?: (score: ExcelPreviewScore) => string
}

/** 生徒×（合計・小計・設問）の表。点数一覧と正誤一覧で共通 */
function StudentScoreTable({
  data,
  questionColumn,
}: {
  data: ExcelPreviewData
  questionColumn: QuestionColumnView
}) {
  const hasSubtotals = data.headers.subtotalLabels.length > 0

  return (
    <table className="w-full border-collapse text-[10px]">
      <thead className="sticky top-0 bg-muted">
        <tr>
          <th className="border px-1 py-0.5 text-left">#</th>
          <th className="border px-1 py-0.5 text-left">氏名</th>
          <th className="border px-1 py-0.5 text-right">合計</th>
          {hasSubtotals &&
            data.headers.subtotalLabels.map((label, i) => (
              <th key={`sub-${i}`} className="border px-1 py-0.5 text-right">
                {label}
              </th>
            ))}
          {data.headers.questionLabels.map((label, i) => (
            <th
              key={i}
              className={`border px-1 py-0.5 ${questionColumn.alignClassName}`}
            >
              {questionColumn.renderHeader(label, i)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, rowIdx) => (
          <tr key={row.examStudentId} className="hover:bg-muted/50">
            <td className="border px-1 py-0.5 text-center">{rowIdx + 1}</td>
            <td className="border px-1 py-0.5 whitespace-nowrap">
              {row.studentName}
            </td>
            <td className="border px-1 py-0.5 text-right font-medium">
              {row.totalScore ?? "-"}
            </td>
            {hasSubtotals &&
              data.headers.subtotalLabels.map((_, i) => {
                const subtotalScore = row.subtotalScores[i]
                return (
                  <td
                    key={`sub-${i}`}
                    className="border px-1 py-0.5 text-right"
                  >
                    {subtotalScore?.score ?? "-"}
                  </td>
                )
              })}
            {row.scores.map((score) => (
              <td
                key={score.questionId}
                className={cn(
                  "border px-1 py-0.5",
                  questionColumn.alignClassName,
                  questionColumn.cellClassName?.(score)
                )}
              >
                {questionColumn.renderCell(score)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface ExcelPreviewProps {
  data: ExcelPreviewData
  /** 類型評価の設問の値の見せ方（試験の個人成績表設定。Excel 出力と同じもの） */
  scaleValueDisplay: ScaleValueDisplay
}

type SheetTab =
  "scores" | "results" | "item-analysis" | "sp-table" | "frequency"

export function ExcelPreview({ data, scaleValueDisplay }: ExcelPreviewProps) {
  const [sheetTab, setSheetTab] = useState<SheetTab>("scores")
  const itemAnalysisData = useItemAnalysis(data)
  const spAnalysis = useSpAnalysis(data)

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={sheetTab}
        onValueChange={(v) => setSheetTab(v as SheetTab)}
        className="flex flex-1 flex-col"
      >
        <TabsList className="mb-1 grid w-full grid-cols-5">
          <TabsTrigger value="scores" className="text-xs">
            点数一覧
          </TabsTrigger>
          <TabsTrigger value="results" className="text-xs">
            正誤一覧
          </TabsTrigger>
          <TabsTrigger value="item-analysis" className="text-xs">
            問題分析
          </TabsTrigger>
          <TabsTrigger value="sp-table" className="text-xs">
            S-P表
          </TabsTrigger>
          <TabsTrigger value="frequency" className="text-xs">
            得点分布
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-0 flex-1 overflow-auto">
          <StudentScoreTable
            data={data}
            questionColumn={{
              alignClassName: "text-right",
              renderHeader: (label, questionIndex) => (
                <>
                  <div>{label}</div>
                  <div className="font-normal text-muted-foreground">
                    ({data.headers.questionMaxScores[questionIndex]})
                  </div>
                </>
              ),
              renderCell: (score) => score.score ?? "-",
            }}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-0 flex-1 overflow-auto">
          <StudentScoreTable
            data={data}
            questionColumn={{
              alignClassName: "text-center",
              renderHeader: (label) => label,
              cellClassName: (score) => getResultCellColor(score),
              renderCell: (score) =>
                getResultCellText(score, scaleValueDisplay),
            }}
          />
        </TabsContent>

        <TabsContent
          value="item-analysis"
          className="mt-0 flex-1 overflow-auto"
        >
          {itemAnalysisData ? (
            <ItemAnalysisPreview data={itemAnalysisData} />
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              データがありません
            </div>
          )}
        </TabsContent>

        <TabsContent value="sp-table" className="mt-0 flex-1 overflow-auto">
          {spAnalysis?.spTable ? (
            <SpTablePreview data={spAnalysis.spTable} />
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              S-P表を作成できる採点データがありません
            </div>
          )}
        </TabsContent>

        <TabsContent value="frequency" className="mt-0 flex-1 overflow-auto">
          {spAnalysis?.frequency ? (
            <FrequencyDistributionChart data={spAnalysis.frequency} />
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              得点分布を作成できる得点データがありません
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
