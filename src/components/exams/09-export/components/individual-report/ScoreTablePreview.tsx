"use client"

/**
 * スコアテーブルプレビューコンポーネント
 * 列数表示とフォントサイズに対応
 */
import type {
  FontSizeOption,
  IndividualReportData,
  IndividualReportOptions,
  ReportPopulation,
} from "@/types/individualReport.types"

import { MultiColumnScoreTable } from "./MultiColumnScoreTable"
import { SingleColumnScoreTable } from "./SingleColumnScoreTable"

interface ScoreTablePreviewProps {
  report: IndividualReportData
  /** 設問別正答率・得点率の供給元（試験に1つ） */
  population: ReportPopulation
  options: IndividualReportOptions
  fontScale: number
}

/** フォントサイズ設定からスケール値を取得 */
function getFontSizeScale(fontSize: FontSizeOption): number {
  // FontSizeOptionは数値（px単位）なので、11pxを基準としてスケールを計算
  return fontSize / 11
}

export function ScoreTablePreview({
  report,
  population,
  options,
  fontScale,
}: ScoreTablePreviewProps) {
  const questionScores = report.scoringData.scores
  const columns = options.questionTableColumns
  const tableFontScale =
    fontScale * getFontSizeScale(options.questionTableFontSize)

  if (questionScores.length === 0) return null

  // 1列表示の場合は従来のテーブル形式
  if (columns === 1) {
    return (
      <SingleColumnScoreTable
        report={report}
        population={population}
        options={options}
        fontScale={tableFontScale}
      />
    )
  }

  // 複数列表示の場合はグリッド形式
  return (
    <MultiColumnScoreTable
      report={report}
      population={population}
      options={options}
      fontScale={tableFontScale}
      columns={columns}
    />
  )
}
